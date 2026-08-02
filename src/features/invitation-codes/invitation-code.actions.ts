"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentAccessContext, hasPermission, PERMISSIONS, withAccessAuditMetadata } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { Prisma } from "@/lib/generated/prisma/client";
import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { INVITE_EXPIRATION_HOURS } from "./invitation-code.constants";
import { consumeInvitationCode } from "./invitation-code.consume";
import { createInvitedCompanyMembership } from "./invitation-code.membership";
import { invitationCodeUnavailableReason } from "./invitation-code.policy";
import { invitationCodeActionSchema, invitationCodeCreateSchema, invitationCodeVerifySchema } from "./invitation-code.schemas";
import { generateInvitationCode, hashInvitationCode } from "./invitation-code.service";

interface IssuedInvitationCode {
  id: string;
  plainToken: string;
  role: CompanyMemberRole;
  expiresAt: string;
}

export type InvitationCodeActionResult = ActionResult<IssuedInvitationCode>;
export type InvitationCodeAcceptanceResult = ActionResult<{ companyId: string; companyName: string; role: CompanyMemberRole }>;

async function contextFor(companyId: string) {
  const context = await getCurrentAccessContext();
  if (!context) return null;
  if (!hasPermission(context.role, PERMISSIONS.USER_MANAGE) || context.role === "STAFF") return null;
  if (context.role !== "DEVELOPER" && context.activeCompanyId !== companyId) return null;
  if (context.role === "DEVELOPER" && !context.availableCompanies?.some((company) => company.id === companyId)) return null;
  return context;
}

const forbidden = (): InvitationCodeActionResult => ({
  success: false,
  status: 403,
  errorCode: "FORBIDDEN",
  message: "이 회사의 초대코드를 관리할 권한이 없습니다.",
});

function invitationUnavailable(): InvitationCodeAcceptanceResult {
  return { success: false, message: "유효하지 않거나 사용할 수 없는 초대코드입니다." };
}

export async function createInvitationCodeAction(
  companyId: string,
  state: InvitationCodeActionResult,
  formData: FormData,
): Promise<InvitationCodeActionResult> {
  void state;
  const parsed = invitationCodeCreateSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return { success: false, message: "발행할 역할을 확인해 주세요." };
  const context = await contextFor(companyId);
  if (!context) return forbidden();

  const generated = generateInvitationCode(parsed.data.role);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_EXPIRATION_HOURS * 60 * 60 * 1000);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({ where: { id: companyId, isActive: true }, select: { id: true } });
      if (!company) throw new Error("COMPANY_UNAVAILABLE");

      const replaced = await tx.invitationCode.findMany({
        where: { companyId, role: parsed.data.role, status: "ACTIVE" },
        select: { id: true },
      });
      if (replaced.length) {
        await tx.invitationCode.updateMany({
          where: { id: { in: replaced.map((code) => code.id) }, companyId, role: parsed.data.role, status: "ACTIVE" },
          data: { status: "REVOKED", revokedAt: now },
        });
      }
      const invitation = await tx.invitationCode.create({
        data: {
          companyId,
          role: parsed.data.role,
          status: "ACTIVE",
          codeHash: generated.codeHash,
          codePrefix: generated.codePrefix,
          expiresAt,
          createdById: context.userId,
        },
        select: { id: true, role: true, expiresAt: true },
      });
      if (replaced.length) {
        await tx.auditLog.create({
          data: {
            actorUserId: context.userId,
            action: "INVITATION_CODE_REPLACED",
            details: withAccessAuditMetadata(context, { companyId, role: parsed.data.role, revokedInvitationCodeIds: replaced.map((code) => code.id), newInvitationCodeId: invitation.id }),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: "INVITATION_CODE_CREATED",
          details: withAccessAuditMetadata(context, { companyId, role: invitation.role, invitationCodeId: invitation.id, before: null, after: { status: "ACTIVE", expiresAt: invitation.expiresAt.toISOString() } }),
        },
      });
      return invitation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/settings/members");
    return {
      success: true,
      message: `${created.role === "ADMIN" ? "관리자" : "직원"} 1회용 초대코드를 발행했습니다.`,
      data: { id: created.id, plainToken: generated.code, role: created.role, expiresAt: created.expiresAt.toISOString() },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_UNAVAILABLE") return { success: false, message: "활성 회사를 찾을 수 없습니다." };
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      return { success: false, message: "동시에 다른 코드가 발행되었습니다. 화면을 새로고침한 뒤 다시 시도해 주세요." };
    }
    throw error;
  }
}

export async function revokeInvitationCodeAction(
  companyId: string,
  _state: InvitationCodeActionResult,
  formData: FormData,
): Promise<InvitationCodeActionResult> {
  const parsed = invitationCodeActionSchema.safeParse({ codeId: formData.get("codeId") });
  if (!parsed.success) return { success: false, message: "잘못된 요청입니다." };
  const context = await contextFor(companyId);
  if (!context) return forbidden();
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitationCode.findFirst({
      where: { id: parsed.data.codeId, companyId, status: "ACTIVE" },
      select: { id: true, role: true },
    });
    if (!invitation) return false;
    const updated = await tx.invitationCode.updateMany({
      where: { id: invitation.id, companyId, status: "ACTIVE", usedAt: null },
      data: { status: "REVOKED", revokedAt: now },
    });
    if (!updated.count) return false;
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        action: "INVITATION_CODE_REVOKED",
        details: withAccessAuditMetadata(context, { companyId, role: invitation.role, invitationCodeId: invitation.id, before: { status: "ACTIVE" }, after: { status: "REVOKED", revokedAt: now.toISOString() } }),
      },
    });
    return true;
  });
  if (!result) return { success: false, message: "사용 가능 상태의 초대코드를 찾을 수 없습니다." };
  revalidatePath("/settings/members");
  return { success: true, message: "초대코드를 폐기했습니다." };
}

export async function verifyInvitationCodeAction(
  code: string,
): Promise<ActionResult<{ companyName: string; role: CompanyMemberRole; expiresAt: string }>> {
  const parsed = invitationCodeVerifySchema.safeParse({ code });
  if (!parsed.success) return { success: false, message: "유효한 초대코드를 입력해 주세요." };
  const invitation = await prisma.invitationCode.findUnique({
    where: { codeHash: hashInvitationCode(parsed.data.code) },
    select: { status: true, role: true, expiresAt: true, company: { select: { name: true, isActive: true } } },
  });
  if (!invitation || !invitation.company.isActive || invitationCodeUnavailableReason(invitation)) {
    return { success: false, message: "유효하지 않거나 사용할 수 없는 초대코드입니다." };
  }
  return {
    success: true,
    message: "초대코드 확인 완료",
    data: { companyName: invitation.company.name, role: invitation.role, expiresAt: invitation.expiresAt.toISOString() },
  };
}

export async function acceptInvitationCodeAction(
  _state: InvitationCodeAcceptanceResult,
  formData: FormData,
): Promise<InvitationCodeAcceptanceResult> {
  const parsed = invitationCodeVerifySchema.safeParse({ code: formData.get("invitationCode") });
  if (!parsed.success) return invitationUnavailable();
  const context = await getCurrentAccessContext();
  if (!context) return { success: false, status: 401, errorCode: "UNAUTHORIZED", message: "로그인한 뒤 초대코드를 수락해 주세요." };
  const now = new Date();

  try {
    const accepted = await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitationCode.findUnique({
        where: { codeHash: hashInvitationCode(parsed.data.code) },
        select: { id: true, status: true, role: true, expiresAt: true, company: { select: { id: true, name: true, isActive: true } } },
      });
      if (!invitation || !invitation.company.isActive || invitationCodeUnavailableReason(invitation, now)) {
        throw new Error("INVITATION_CODE_UNAVAILABLE");
      }
      const existing = await tx.companyMembership.findUnique({
        where: { userId_companyId: { userId: context.userId, companyId: invitation.company.id } },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_MEMBER");

      const consumed = await consumeInvitationCode(tx, invitation.id, context.userId, now);
      if (!consumed) throw new Error("INVITATION_CODE_UNAVAILABLE");
      const membership = await createInvitedCompanyMembership(tx, {
        userId: context.userId,
        companyId: consumed.companyId,
        role: consumed.role,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: context.userId,
          targetUserId: context.userId,
          action: "INVITATION_CODE_USED",
          details: withAccessAuditMetadata(context, { companyId: consumed.companyId, role: consumed.role, propertyIds: membership.propertyIds, invitationCodeId: consumed.id, before: { status: "ACTIVE" }, after: { status: "USED", usedAt: now.toISOString() } }),
        },
      });
      return { companyId: invitation.company.id, companyName: invitation.company.name, role: consumed.role };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/", "layout");
    return { success: true, message: `${accepted.companyName} 회사에 가입했습니다.`, data: accepted };
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_MEMBER") {
      return { success: false, message: "이미 이 회사의 구성원입니다." };
    }
    if (error instanceof Error && error.message === "INVITATION_CODE_UNAVAILABLE") return invitationUnavailable();
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: "이미 이 회사의 구성원입니다." };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { success: false, message: "이 초대코드가 다른 요청에서 먼저 사용되었습니다." };
    }
    throw error;
  }
}
