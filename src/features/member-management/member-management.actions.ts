"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccessContext, hasPermission, PERMISSIONS } from "@/features/access-control";
import { getOptionalSession } from "@/features/auth/server/get-current-user";
import { hashPassword } from "@/features/auth/server/password";
import type { ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/prisma-errors";
import { INVITATION_EXPIRATION_DAYS } from "./member-management.constants";
import { acceptInvitationSchema, invitationActionSchema, inviteMemberSchema, memberStatusSchema, updateMemberSchema } from "./member-management.schemas";
import { assertCanManageMember, assertLastActiveAdminSafe, MemberPolicyError } from "./domain/member-policy";
import { createInvitationToken, hashInvitationToken } from "./invitation-token";
import { invitationMailProvider } from "./invitation-mail.provider";

export type InvitationActionResult = ActionResult<{ invitationUrl?: string }>;
const FORBIDDEN_MESSAGE = "해당 사용자를 관리할 권한이 없습니다.";
const forbidden = (): ActionResult => ({ success: false, status: 403, errorCode: "FORBIDDEN", message: FORBIDDEN_MESSAGE });

async function managementContext(companyId: string) {
  const context = await getCurrentAccessContext();
  if (!context || !hasPermission(context.role, PERMISSIONS.USER_MANAGE)) return null;
  if (context.role !== "DEVELOPER" && context.activeCompanyId !== companyId) return null;
  if (context.role === "DEVELOPER" && !context.availableCompanies?.some((company) => company.id === companyId)) return null;
  return context;
}

async function validPropertyIds(companyId: string, propertyIds: string[]) {
  const unique = [...new Set(propertyIds)];
  const count = await prisma.property.count({ where: { companyId, id: { in: unique }, isActive: true } });
  return count === unique.length ? unique : null;
}

function invitationUrl(token: string) {
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${baseUrl}/invitations/${encodeURIComponent(token)}`;
}

async function deliverInvitation(invitationId: string, input: { email: string; companyName: string; inviterName: string; token: string; message?: string }) {
  try {
    await invitationMailProvider.sendInvitation({ to: input.email, companyName: input.companyName, inviterName: input.inviterName, invitationUrl: invitationUrl(input.token), message: input.message });
    await prisma.companyInvitation.update({ where: { id: invitationId }, data: { mailStatus: "SENT", mailError: null } });
    return true;
  } catch (error) {
    await prisma.companyInvitation.update({ where: { id: invitationId }, data: { mailStatus: "FAILED", mailError: error instanceof Error ? error.message.slice(0, 300) : "메일 발송 실패" } });
    logServerError("sendCompanyInvitation", error);
    return false;
  }
}

export async function inviteCompanyMemberAction(_state: InvitationActionResult, formData: FormData): Promise<InvitationActionResult> {
  const parsed = inviteMemberSchema.safeParse({ companyId: formData.get("companyId"), email: formData.get("email"), displayName: formData.get("displayName"), role: formData.get("role"), propertyIds: formData.getAll("propertyIds"), message: formData.get("message") });
  if (!parsed.success) return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: "초대 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  const context = await managementContext(parsed.data.companyId);
  if (!context) return forbidden();
  const propertyIds = await validPropertyIds(parsed.data.companyId, parsed.data.propertyIds);
  if (!propertyIds) return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: "선택한 숙소 중 해당 회사에 속하지 않은 숙소가 있습니다." };
  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, memberships: { where: { companyId: parsed.data.companyId }, select: { status: true } } } });
  const membership = existingUser?.memberships[0];
  if (membership?.status === "ACTIVE") return { success: false, message: "이미 이 회사에 등록된 이메일입니다." };
  if (membership?.status === "DISABLED") return { success: false, message: "비활성화된 기존 구성원입니다. 구성원 목록에서 재활성화해 주세요." };
  const pending = await prisma.companyInvitation.findFirst({ where: { companyId: parsed.data.companyId, email: parsed.data.email, acceptedAt: null, cancelledAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
  if (pending) return { success: false, message: "이미 초대가 진행 중인 이메일입니다." };
  const token = createInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  const created = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirstOrThrow({ where: { id: parsed.data.companyId, isActive: true }, select: { name: true } });
    const invitation = await tx.companyInvitation.create({ data: { companyId: parsed.data.companyId, email: parsed.data.email, displayName: parsed.data.displayName, role: parsed.data.role, propertyIds, message: parsed.data.message, tokenHash: hashInvitationToken(token), expiresAt, invitedById: context.userId } });
    await tx.auditLog.create({ data: { actorUserId: context.userId, targetUserId: existingUser?.id, action: "MEMBER_INVITED", details: { companyId: parsed.data.companyId, email: parsed.data.email, role: parsed.data.role, propertyIds } } });
    return { invitation, company };
  });
  const sent = await deliverInvitation(created.invitation.id, { email: parsed.data.email, companyName: created.company.name, inviterName: context.name ?? context.email ?? "StayBoard 관리자", token, message: parsed.data.message });
  revalidatePath("/settings/members");
  return { success: true, data: process.env.NODE_ENV === "production" ? undefined : { invitationUrl: invitationUrl(token) }, message: sent ? "구성원 초대를 보냈습니다." : "초대는 저장했지만 메일 발송에 실패했습니다. 다시 보내기를 이용해 주세요." };
}

export async function updateCompanyMemberAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = updateMemberSchema.safeParse({ companyId: formData.get("companyId"), membershipId: formData.get("membershipId"), name: formData.get("name"), role: formData.get("role"), propertyIds: formData.getAll("propertyIds") });
  if (!parsed.success) return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: "구성원 설정을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  const context = await managementContext(parsed.data.companyId); if (!context) return forbidden();
  const target = await prisma.companyMembership.findFirst({ where: { id: parsed.data.membershipId, companyId: parsed.data.companyId }, select: { id: true, userId: true, role: true, status: true, user: { select: { name: true } }, propertyAccesses: { select: { propertyId: true } } } });
  if (!target) return forbidden();
  try { assertCanManageMember({ actorRole: context.role, actorUserId: context.userId, targetUserId: target.userId, targetRole: target.role, sameCompany: true, action: "CHANGE_ROLE" }); } catch (error) { return { success: false, message: error instanceof Error ? error.message : FORBIDDEN_MESSAGE }; }
  const propertyIds = await validPropertyIds(parsed.data.companyId, parsed.data.propertyIds); if (!propertyIds) return { success: false, message: "선택한 숙소 중 해당 회사에 속하지 않은 숙소가 있습니다." };
  const activeAdminCount = await prisma.companyMembership.count({ where: { companyId: parsed.data.companyId, role: "ADMIN", status: "ACTIVE" } });
  try { assertLastActiveAdminSafe({ currentRole: target.role, nextRole: parsed.data.role, activeAdminCount }); } catch (error) { return { success: false, message: error instanceof Error ? error.message : "회사에는 최소 한 명의 관리자가 필요합니다." }; }
  await prisma.$transaction(async (tx) => { await tx.user.update({ where: { id: target.userId }, data: { name: parsed.data.name } }); await tx.companyMembership.update({ where: { id: target.id }, data: { role: parsed.data.role } }); await tx.propertyAccess.deleteMany({ where: { membershipId: target.id } }); if (parsed.data.role === "STAFF") await tx.propertyAccess.createMany({ data: propertyIds.map((propertyId) => ({ membershipId: target.id, propertyId })) }); await tx.auditLog.create({ data: { actorUserId: context.userId, targetUserId: target.userId, action: "MEMBER_UPDATED", details: { companyId: parsed.data.companyId, before: { name: target.user.name, role: target.role, propertyIds: target.propertyAccesses.map((item) => item.propertyId) }, after: { name: parsed.data.name, role: parsed.data.role, propertyIds: parsed.data.role === "STAFF" ? propertyIds : [] } } } }); });
  revalidatePath("/settings/members"); return { success: true, message: "구성원 권한을 저장했습니다." };
}

export async function setCompanyMemberActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = memberStatusSchema.safeParse({ companyId: formData.get("companyId"), membershipId: formData.get("membershipId"), active: formData.get("active") }); if (!parsed.success) return { success: false, message: "잘못된 요청입니다." };
  const context = await managementContext(parsed.data.companyId); if (!context) return forbidden();
  const target = await prisma.companyMembership.findFirst({ where: { id: parsed.data.membershipId, companyId: parsed.data.companyId }, select: { id: true, userId: true, role: true, status: true } }); if (!target) return forbidden();
  try { assertCanManageMember({ actorRole: context.role, actorUserId: context.userId, targetUserId: target.userId, targetRole: target.role, sameCompany: true, action: parsed.data.active ? "REACTIVATE_MEMBER" : "DISABLE_MEMBER" }); const activeAdminCount = await prisma.companyMembership.count({ where: { companyId: parsed.data.companyId, role: "ADMIN", status: "ACTIVE" } }); assertLastActiveAdminSafe({ currentRole: target.role, disabling: !parsed.data.active, activeAdminCount }); } catch (error) { return { success: false, message: error instanceof Error ? error.message : FORBIDDEN_MESSAGE }; }
  await prisma.$transaction([prisma.companyMembership.update({ where: { id: target.id }, data: { status: parsed.data.active ? "ACTIVE" : "DISABLED", disabledAt: parsed.data.active ? null : new Date() } }), prisma.auditLog.create({ data: { actorUserId: context.userId, targetUserId: target.userId, action: parsed.data.active ? "MEMBER_REACTIVATED" : "MEMBER_DISABLED", details: { companyId: parsed.data.companyId, before: target.status, after: parsed.data.active ? "ACTIVE" : "DISABLED" } } })]);
  revalidatePath("/settings/members"); return { success: true, message: parsed.data.active ? "구성원을 재활성화했습니다." : "구성원을 비활성화했습니다." };
}

export async function cancelInvitationAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = invitationActionSchema.safeParse({ companyId: formData.get("companyId"), invitationId: formData.get("invitationId") }); if (!parsed.success) return { success: false, message: "잘못된 요청입니다." };
  const context = await managementContext(parsed.data.companyId); if (!context) return forbidden();
  const invitation = await prisma.companyInvitation.findFirst({ where: { id: parsed.data.invitationId, companyId: parsed.data.companyId, acceptedAt: null }, select: { id: true, email: true, cancelledAt: true } }); if (!invitation || invitation.cancelledAt) return { success: false, message: "이미 취소되었거나 완료된 초대입니다." };
  await prisma.$transaction([prisma.companyInvitation.update({ where: { id: invitation.id }, data: { cancelledAt: new Date() } }), prisma.auditLog.create({ data: { actorUserId: context.userId, action: "INVITATION_CANCELLED", details: { companyId: parsed.data.companyId, email: invitation.email } } })]); revalidatePath("/settings/members"); return { success: true, message: "초대를 취소했습니다." };
}

export async function resendInvitationAction(_state: InvitationActionResult, formData: FormData): Promise<InvitationActionResult> {
  const parsed = invitationActionSchema.safeParse({ companyId: formData.get("companyId"), invitationId: formData.get("invitationId") }); if (!parsed.success) return { success: false, message: "잘못된 요청입니다." };
  const context = await managementContext(parsed.data.companyId); if (!context) return forbidden();
  const invitation = await prisma.companyInvitation.findFirst({ where: { id: parsed.data.invitationId, companyId: parsed.data.companyId, acceptedAt: null, cancelledAt: null }, select: { id: true, email: true, message: true, company: { select: { name: true } } } }); if (!invitation) return { success: false, message: "다시 보낼 수 없는 초대입니다." };
  const token = createInvitationToken(); const expiresAt = new Date(Date.now() + INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.$transaction([prisma.companyInvitation.update({ where: { id: invitation.id }, data: { tokenHash: hashInvitationToken(token), expiresAt, mailStatus: "PENDING", mailError: null } }), prisma.auditLog.create({ data: { actorUserId: context.userId, action: "INVITATION_RESENT", details: { companyId: parsed.data.companyId, email: invitation.email } } })]);
  const sent = await deliverInvitation(invitation.id, { email: invitation.email, companyName: invitation.company.name, inviterName: context.name ?? "StayBoard 관리자", token, message: invitation.message ?? undefined }); revalidatePath("/settings/members"); return { success: true, data: process.env.NODE_ENV === "production" ? undefined : { invitationUrl: invitationUrl(token) }, message: sent ? "초대를 다시 보냈습니다." : "초대 링크는 갱신했지만 메일 발송에 실패했습니다." };
}

export async function acceptCompanyInvitationAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = acceptInvitationSchema.safeParse({ token: formData.get("token"), name: formData.get("name") || undefined, password: formData.get("password") || undefined }); if (!parsed.success) return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: "가입 정보를 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  const invitation = await prisma.companyInvitation.findUnique({ where: { tokenHash: hashInvitationToken(parsed.data.token) }, select: { id: true, companyId: true, email: true, role: true, propertyIds: true, expiresAt: true, acceptedAt: true, cancelledAt: true } });
  if (!invitation) return { success: false, message: "유효하지 않은 초대입니다." }; if (invitation.acceptedAt) return { success: false, message: "이미 사용된 초대입니다." }; if (invitation.cancelledAt) return { success: false, message: "이 초대는 취소되었습니다." }; if (invitation.expiresAt <= new Date()) return { success: false, message: "초대가 만료되었습니다." };
  const session = await getOptionalSession(); const sessionUser = session?.user.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true } }) : null;
  if (sessionUser && sessionUser.email.toLowerCase() !== invitation.email) return { success: false, message: "초대 이메일과 로그인 이메일이 일치하지 않습니다." };
  if (!sessionUser && (!parsed.data.name || !parsed.data.password)) return { success: false, message: "로그인하거나 이름과 비밀번호를 입력해 가입해 주세요." };
  const existingUser = !sessionUser ? await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } }) : null;
  if (existingUser) return { success: false, message: "이미 가입된 이메일입니다. 해당 계정으로 로그인한 뒤 초대를 수락해 주세요." };
  const propertyIds = Array.isArray(invitation.propertyIds) ? invitation.propertyIds.filter((item): item is string => typeof item === "string") : [];
  try {
    await prisma.$transaction(async (tx) => {
      const existing = sessionUser ?? await tx.user.findUnique({ where: { email: invitation.email }, select: { id: true, email: true } });
      const user = existing ?? await tx.user.create({ data: { email: invitation.email, name: parsed.data.name!, passwordHash: await hashPassword(parsed.data.password!), systemRole: "NONE", isActive: true }, select: { id: true, email: true } });
      if (user.email.toLowerCase() !== invitation.email) throw new MemberPolicyError("초대 이메일과 계정 이메일이 일치하지 않습니다.");
      const membership = await tx.companyMembership.upsert({ where: { userId_companyId: { userId: user.id, companyId: invitation.companyId } }, create: { userId: user.id, companyId: invitation.companyId, role: invitation.role, status: "ACTIVE" }, update: { role: invitation.role, status: "ACTIVE", disabledAt: null }, select: { id: true } });
      await tx.propertyAccess.deleteMany({ where: { membershipId: membership.id } }); if (invitation.role === "STAFF" && propertyIds.length) await tx.propertyAccess.createMany({ data: propertyIds.map((propertyId) => ({ membershipId: membership.id, propertyId })) });
      await tx.companyInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }); await tx.auditLog.create({ data: { actorUserId: user.id, targetUserId: user.id, action: "INVITATION_ACCEPTED", details: { companyId: invitation.companyId, role: invitation.role, propertyIds } } });
    });
    return { success: true, message: sessionUser ? "초대를 수락했습니다. 회사 화면으로 이동해 주세요." : "초대를 수락하고 계정을 만들었습니다. 로그인해 주세요." };
  } catch (error) { logServerError("acceptCompanyInvitation", error); return { success: false, message: error instanceof MemberPolicyError ? error.message : "초대를 수락하지 못했습니다." }; }
}
