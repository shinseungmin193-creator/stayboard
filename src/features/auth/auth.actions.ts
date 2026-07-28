"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { signupSchema } from "./auth.schemas";
import { hashPassword } from "./server/password";
import { hashInvitationCode } from "@/features/invitation-codes/invitation-code.service";
import { invitationCodeUnavailableReason } from "@/features/invitation-codes/invitation-code.policy";
import { consumeInvitationCode } from "@/features/invitation-codes/invitation-code.consume";
import { createInvitedCompanyMembership } from "@/features/invitation-codes/invitation-code.membership";

export async function signupAction(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    signupType: formData.get("signupType") || "new-company",
    companyName: formData.get("companyName") || undefined,
    invitationCode: formData.get("invitationCode") || undefined,
  });
  if (!parsed.success) return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          systemRole: "NONE",
          isActive: true,
        },
      });
      let companyId: string;
      let auditAction: "PUBLIC_SIGNUP" | "INVITATION_CODE_USED";
      let invitationCodeId: string | undefined;
      let membershipRole: CompanyMemberRole = "ADMIN";
      let propertyIds: string[] = [];

      if (parsed.data.signupType === "new-company") {
        const company = await tx.company.create({ data: { name: parsed.data.companyName! } });
        companyId = company.id;
        auditAction = "PUBLIC_SIGNUP";
      } else {
        const invitation = await tx.invitationCode.findUnique({ where: { codeHash: hashInvitationCode(parsed.data.invitationCode!) }, select: { id: true, status: true, role: true, expiresAt: true, company: { select: { isActive: true } } } });
        if (!invitation || !invitation.company.isActive || invitationCodeUnavailableReason(invitation)) throw new Error("INVITATION_CODE_UNAVAILABLE");
        const consumed = await consumeInvitationCode(tx, invitation.id, user.id);
        if (!consumed) throw new Error("INVITATION_CODE_UNAVAILABLE");
        companyId = consumed.companyId;
        membershipRole = consumed.role;
        invitationCodeId = consumed.id;
        auditAction = "INVITATION_CODE_USED";
      }

      if (parsed.data.signupType === "new-company") {
        await tx.companyMembership.create({ data: { userId: user.id, companyId, role: "ADMIN", status: "ACTIVE" } });
      } else {
        const membership = await createInvitedCompanyMembership(tx, { userId: user.id, companyId, role: membershipRole });
        propertyIds = membership.propertyIds;
      }
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          targetUserId: user.id,
          action: auditAction,
          details: { companyId, role: membershipRole, propertyIds, ...(invitationCodeId ? { invitationCodeId, before: { status: "ACTIVE" }, after: { status: "USED" } } : {}) },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true, message: parsed.data.signupType === "new-company" ? "계정과 회사가 생성되었습니다." : "초대코드로 회사에 가입했습니다.", data: { email: parsed.data.email } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: "이미 계정이 있습니다. 로그인한 뒤 초대코드를 수락해 주세요.", fieldErrors: { email: ["기존 계정으로 로그인해 주세요."] } };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return { success: false, message: "이 초대코드가 다른 가입 요청에서 먼저 사용되었습니다.", fieldErrors: { invitationCode: ["새 초대코드를 발행받아 주세요."] } };
    if (error instanceof Error && error.message === "INVITATION_CODE_UNAVAILABLE") return { success: false, message: "유효하지 않거나 사용할 수 없는 초대코드입니다.", fieldErrors: { invitationCode: ["초대코드를 다시 확인해 주세요."] } };
    console.error(JSON.stringify({ event: "AUTH_SIGNUP_FAILED", errorName: error instanceof Error ? error.name : "UnknownError", timestamp: new Date().toISOString() }));
    return { success: false, message: "회원가입을 완료하지 못했습니다." };
  }
}
