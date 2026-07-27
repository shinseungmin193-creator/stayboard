"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccessContext, hasPermission, PERMISSIONS } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateInvitationCode, hashInvitationCode, invitationCodeUnavailableReason } from "./invitation-code.service";
import { invitationCodeActionSchema, invitationCodeVerifySchema } from "./invitation-code.schemas";

export type InvitationCodeActionResult = ActionResult<{ code?: string; codeId?: string }>;

async function contextFor(companyId: string) {
  const context = await getCurrentAccessContext();
  if (!context || !hasPermission(context.role, PERMISSIONS.USER_MANAGE) || context.role === "STAFF") return null;
  if (context.role !== "DEVELOPER" && context.activeCompanyId !== companyId) return null;
  if (context.role === "DEVELOPER" && !context.availableCompanies?.some((company) => company.id === companyId)) return null;
  return context;
}

const forbidden = (): InvitationCodeActionResult => ({ success: false, status: 403, errorCode: "FORBIDDEN", message: "이 회사의 초대코드를 관리할 권한이 없습니다." });

export async function createInvitationCodeAction(companyId: string, state: InvitationCodeActionResult, formData: FormData): Promise<InvitationCodeActionResult> {
  void state;
  void formData;
  const context = await contextFor(companyId);
  if (!context) return forbidden();
  const generated = generateInvitationCode();
  const now = new Date();
  try {
    const createdId = await prisma.$transaction(async (tx) => {
      const replaced = await tx.invitationCode.findMany({ where: { companyId, status: "ACTIVE" }, select: { id: true } });
      await tx.invitationCode.updateMany({ where: { id: { in: replaced.map((code) => code.id) }, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now } });
      const created = await tx.invitationCode.create({ data: { companyId, role: "ADMIN", status: "ACTIVE", codeHash: generated.codeHash, codePrefix: generated.codePrefix, createdById: context.userId } });
      if (replaced.length) await tx.auditLog.create({ data: { actorUserId: context.userId, action: "INVITATION_CODE_REPLACED", details: { companyId, revokedInvitationCodeIds: replaced.map((code) => code.id), newInvitationCodeId: created.id } } });
      await tx.auditLog.create({ data: { actorUserId: context.userId, action: "INVITATION_CODE_ADMIN_CREATED", details: { companyId, invitationCodeId: created.id, replacedExistingActiveCode: replaced.length > 0 } } });
      return created.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/settings/members");
    return { success: true, message: "1회용 관리자 초대코드를 발행했습니다.", data: { code: generated.code, codeId: createdId } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return { success: false, message: "동시에 다른 코드가 발행되었습니다. 화면을 새로고침한 후 다시 시도해 주세요." };
    throw error;
  }
}

export async function revokeInvitationCodeAction(companyId: string, _state: InvitationCodeActionResult, formData: FormData): Promise<InvitationCodeActionResult> {
  const parsed = invitationCodeActionSchema.safeParse({ codeId: formData.get("codeId") });
  if (!parsed.success) return { success: false, message: "잘못된 요청입니다." };
  const context = await contextFor(companyId);
  if (!context) return forbidden();
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.invitationCode.updateMany({ where: { id: parsed.data.codeId, companyId, role: "ADMIN", status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now } });
    if (!updated.count) return false;
    await tx.auditLog.create({ data: { actorUserId: context.userId, action: "INVITATION_CODE_REVOKED", details: { companyId, invitationCodeId: parsed.data.codeId } } });
    return true;
  });
  if (!result) return { success: false, message: "사용 가능 상태의 초대코드를 찾을 수 없습니다." };
  revalidatePath("/settings/members");
  return { success: true, message: "초대코드를 폐기했습니다." };
}

export async function verifyInvitationCodeAction(code: string): Promise<ActionResult<{ companyName: string; role: "ADMIN" }>> {
  const parsed = invitationCodeVerifySchema.safeParse({ code });
  if (!parsed.success) return { success: false, message: "유효한 관리자 초대코드를 입력해 주세요." };
  const invitation = await prisma.invitationCode.findUnique({ where: { codeHash: hashInvitationCode(parsed.data.code) }, select: { status: true, role: true, company: { select: { name: true, isActive: true } } } });
  if (!invitation || invitation.role !== "ADMIN" || !invitation.company.isActive || invitationCodeUnavailableReason(invitation)) return { success: false, message: "유효하지 않거나 사용할 수 없는 관리자 초대코드입니다." };
  return { success: true, message: "관리자 초대코드 확인 완료", data: { companyName: invitation.company.name, role: "ADMIN" } };
}
