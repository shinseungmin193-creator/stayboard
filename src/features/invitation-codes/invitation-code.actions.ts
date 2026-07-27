"use server";
import { revalidatePath } from "next/cache";
import { getCurrentAccessContext, hasPermission, PERMISSIONS } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { generateInvitationCode, hashInvitationCode, invitationCodeUnavailableReason } from "./invitation-code.service";
import { invitationCodeActionSchema, invitationCodeInputSchema, invitationCodeVerifySchema } from "./invitation-code.schemas";

export type InvitationCodeActionResult = ActionResult<{ code?: string }>;
async function contextFor(companyId: string) {
  const context = await getCurrentAccessContext();
  if (!context || !hasPermission(context.role, PERMISSIONS.USER_MANAGE) || context.role === "STAFF") return null;
  if (context.role !== "DEVELOPER" && context.activeCompanyId !== companyId) return null;
  if (context.role === "DEVELOPER" && !context.availableCompanies?.some((company) => company.id === companyId)) return null;
  return context;
}
const forbidden = (): InvitationCodeActionResult => ({ success: false, status: 403, errorCode: "FORBIDDEN", message: "이 회사의 초대코드를 관리할 권한이 없습니다." });

export async function createInvitationCodeAction(_state: InvitationCodeActionResult, formData: FormData): Promise<InvitationCodeActionResult> {
  const parsed = invitationCodeInputSchema.safeParse({ companyId: formData.get("companyId"), role: formData.get("role"), expiresAt: formData.get("expiresAt") || undefined, maxUses: formData.get("maxUses") || 1 });
  if (!parsed.success) return { success: false, message: "초대코드 설정을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  const context = await contextFor(parsed.data.companyId); if (!context) return forbidden();
  const generated = generateInvitationCode(parsed.data.role);
  await prisma.$transaction([prisma.invitationCode.create({ data: { companyId: parsed.data.companyId, role: parsed.data.role, codeHash: generated.codeHash, codePrefix: generated.codePrefix, expiresAt: parsed.data.expiresAt, maxUses: parsed.data.maxUses, createdById: context.userId } }), prisma.auditLog.create({ data: { actorUserId: context.userId, action: `INVITATION_CODE_${parsed.data.role}_CREATED`, details: { companyId: parsed.data.companyId, role: parsed.data.role, expiresAt: parsed.data.expiresAt?.toISOString() ?? null, maxUses: parsed.data.maxUses } } })]);
  revalidatePath("/settings/members"); return { success: true, message: "초대코드를 생성했습니다.", data: { code: generated.code } };
}

async function codeMutation(formData: FormData, mode: "ACTIVATE" | "DEACTIVATE" | "ROTATE" | "REVOKE"): Promise<InvitationCodeActionResult> {
  const parsed = invitationCodeActionSchema.safeParse({ companyId: formData.get("companyId"), codeId: formData.get("codeId") }); if (!parsed.success) return { success: false, message: "잘못된 요청입니다." };
  const context = await contextFor(parsed.data.companyId); if (!context) return forbidden();
  const current = await prisma.invitationCode.findFirst({ where: { id: parsed.data.codeId, companyId: parsed.data.companyId } }); if (!current) return forbidden();
  if (mode === "ROTATE") {
    const generated = generateInvitationCode(current.role);
    await prisma.$transaction([prisma.invitationCode.update({ where: { id: current.id }, data: { isActive: false } }), prisma.invitationCode.create({ data: { companyId: current.companyId, role: current.role, codeHash: generated.codeHash, codePrefix: generated.codePrefix, expiresAt: current.expiresAt, maxUses: current.maxUses, createdById: context.userId } }), prisma.auditLog.create({ data: { actorUserId: context.userId, action: "INVITATION_CODE_ROTATED", details: { companyId: current.companyId, codeId: current.id, role: current.role } } })]);
    revalidatePath("/settings/members"); return { success: true, message: "초대코드를 재발급했습니다.", data: { code: generated.code } };
  }
  const action = mode === "REVOKE"
    ? "INVITATION_CODE_REVOKED"
    : mode === "ACTIVATE"
      ? "INVITATION_CODE_ACTIVATED"
      : "INVITATION_CODE_DEACTIVATED";
  await prisma.$transaction([
    mode === "REVOKE"
      ? prisma.invitationCode.delete({ where: { id: current.id } })
      : prisma.invitationCode.update({ where: { id: current.id }, data: { isActive: mode === "ACTIVATE" } }),
    prisma.auditLog.create({ data: { actorUserId: context.userId, action, details: { companyId: current.companyId, codeId: current.id, role: current.role } } }),
  ]);
  revalidatePath("/settings/members");
  return {
    success: true,
    message: mode === "REVOKE" ? "초대코드를 폐기했습니다." : mode === "ACTIVATE" ? "초대코드를 활성화했습니다." : "초대코드를 비활성화했습니다.",
  };
}
export async function activateInvitationCodeAction(_state: InvitationCodeActionResult, formData: FormData) { return codeMutation(formData, "ACTIVATE"); }
export async function deactivateInvitationCodeAction(_state: InvitationCodeActionResult, formData: FormData) { return codeMutation(formData, "DEACTIVATE"); }
export async function rotateInvitationCodeAction(_state: InvitationCodeActionResult, formData: FormData) { return codeMutation(formData, "ROTATE"); }
export async function revokeInvitationCodeAction(_state: InvitationCodeActionResult, formData: FormData) { return codeMutation(formData, "REVOKE"); }

export async function verifyInvitationCodeAction(code: string): Promise<ActionResult<{ companyName: string; role: "ADMIN" | "STAFF" }>> {
  const parsed = invitationCodeVerifySchema.safeParse({ code }); if (!parsed.success) return { success: false, message: "유효한 초대코드를 입력해 주세요." };
  const invitation = await prisma.invitationCode.findUnique({ where: { codeHash: hashInvitationCode(parsed.data.code) }, select: { isActive: true, expiresAt: true, maxUses: true, usedCount: true, role: true, company: { select: { name: true, isActive: true } } } });
  if (!invitation || !invitation.company.isActive || invitationCodeUnavailableReason(invitation)) return { success: false, message: "유효하지 않거나 사용할 수 없는 초대코드입니다." };
  return { success: true, message: "초대코드 확인 완료", data: { companyName: invitation.company.name, role: invitation.role } };
}
