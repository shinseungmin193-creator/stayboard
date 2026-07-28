"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentAccessContext, getRolePreviewWriteBlock, hasPermission, PERMISSIONS, type AccessContext, type UserRole } from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword } from "@/features/auth/server/password";
import { canAssignRole, canChangeAccountRole, canCreateUserRole, canDeactivateAccount, canManageTarget } from "./domain/account-policy";
import { createManagedUserSchema, managedUserActiveSchema, managedUserRoleSchema, resetManagedUserPasswordSchema, staffAssignmentsSchema } from "./user-management.schemas";

const forbidden = (): ActionResult => ({ success: false, message: "이 계정을 관리할 권한이 없습니다." });

async function actorContext() {
  const context = await getCurrentAccessContext();
  if (getRolePreviewWriteBlock(context)) return context;
  return context && hasPermission(context.role, PERMISSIONS.USER_MANAGE) ? context : null;
}

async function targetInfo(userId: string, context: AccessContext) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, status: true, systemRole: true, memberships: { select: { companyId: true, role: true, status: true } } } });
  if (!target) return null;
  const membership = target.memberships.find((item) => item.companyId === context.activeCompanyId) ?? target.memberships[0];
  const targetRole: UserRole = target.systemRole === "DEVELOPER" ? "DEVELOPER" : membership?.role ?? "STAFF";
  return { ...target, targetRole, sameCompany: Boolean(context.activeCompanyId && target.memberships.some((item) => item.companyId === context.activeCompanyId)) };
}

async function validateAssignments(companyId: string, propertyIds: string[], roomIds: string[]) {
  const [propertyCount, rooms] = await Promise.all([
    prisma.property.count({ where: { id: { in: propertyIds }, companyId } }),
    prisma.room.findMany({ where: { id: { in: roomIds }, property: { companyId } }, select: { id: true, propertyId: true } }),
  ]);
  return propertyCount === new Set(propertyIds).size && rooms.length === new Set(roomIds).size ? rooms : null;
}

export async function createManagedUserAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const context = await actorContext();
  if (!context) return forbidden();
  const previewBlock = getRolePreviewWriteBlock(context);
  if (previewBlock) return previewBlock;
  const parsed = createManagedUserSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), role: formData.get("role"), isActive: formData.get("isActive") ?? "false", companyId: formData.get("companyId") || undefined, propertyIds: formData.getAll("propertyIds"), roomIds: formData.getAll("roomIds") });
  if (!parsed.success) return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  if (!canCreateUserRole(context.role, parsed.data.role)) return forbidden();
  const companyId = parsed.data.companyId;
  if (!companyId || (context.role !== "DEVELOPER" && companyId !== context.activeCompanyId)) return forbidden();
  const assignments = await validateAssignments(companyId, parsed.data.propertyIds, parsed.data.roomIds);
  if (!assignments) return { success: false, message: "배정할 숙소 또는 객실이 회사 범위와 일치하지 않습니다." };
  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash, systemRole: "NONE", isActive: parsed.data.isActive, status: parsed.data.isActive ? "ACTIVE" : "SUSPENDED" } });
      await tx.companyMembership.create({ data: { userId: user.id, companyId, role: parsed.data.role === "ADMIN" ? "ADMIN" : "STAFF" } });
      if (parsed.data.role === "STAFF") await tx.staffAssignment.createMany({ data: [...parsed.data.propertyIds.map((propertyId) => ({ userId: user.id, propertyId })), ...assignments.map((room) => ({ userId: user.id, roomId: room.id }))], skipDuplicates: true });
      await tx.auditLog.create({ data: { actorUserId: context.userId, targetUserId: user.id, action: "USER_CREATED", details: { role: parsed.data.role, companyId, isActive: parsed.data.isActive } } });
    });
    revalidatePath("/settings/admin");
    return { success: true, message: "계정을 생성했습니다." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, message: "이미 사용 중인 이메일입니다.", fieldErrors: { email: ["이미 사용 중인 이메일입니다."] } };
    return { success: false, message: "계정을 생성하지 못했습니다." };
  }
}

export async function setManagedUserActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const context = await actorContext(); const parsed = managedUserActiveSchema.safeParse({ userId: formData.get("userId"), isActive: formData.get("isActive") });
  if (!context || !parsed.success) return forbidden();
  const previewBlock = getRolePreviewWriteBlock(context); if (previewBlock) return previewBlock;
  const target = await targetInfo(parsed.data.userId, context);
  if (!target || !canManageTarget({ actorRole: context.role, actorUserId: context.userId, targetUserId: target.id, targetRole: target.targetRole, sameCompany: target.sameCompany })) return forbidden();
  if (target.status === "DELETED") return { success: false, message: "탈퇴한 계정의 상태는 변경할 수 없습니다." };
  const activeDeveloperCount = target.targetRole === "DEVELOPER" ? await prisma.user.count({ where: { systemRole: "DEVELOPER", isActive: true } }) : 0;
  if (!parsed.data.isActive && !canDeactivateAccount({ isSelf: context.userId === target.id, targetRole: target.targetRole, activeDeveloperCount })) return { success: false, message: target.id === context.userId ? "자기 계정은 비활성화할 수 없습니다." : "마지막 활성 개발자는 비활성화할 수 없습니다." };
  if (!parsed.data.isActive && target.memberships.some((membership) => membership.role === "ADMIN" && membership.status === "ACTIVE")) {
    const protectedCompanies = await Promise.all(target.memberships.filter((membership) => membership.role === "ADMIN" && membership.status === "ACTIVE").map(async (membership) => prisma.companyMembership.count({ where: { companyId: membership.companyId, userId: { not: target.id }, role: "ADMIN", status: "ACTIVE", user: { status: "ACTIVE", isActive: true } } })));
    if (protectedCompanies.some((count) => count === 0)) return { success: false, message: "마지막 관리자는 개발자 회원 상세 화면에서 안전 조치를 선택한 뒤 처리해 주세요." };
  }
  await prisma.$transaction([prisma.user.update({ where: { id: target.id }, data: { isActive: parsed.data.isActive, status: parsed.data.isActive ? "ACTIVE" : "SUSPENDED", sessionVersion: { increment: 1 } } }), prisma.auditLog.create({ data: { actorUserId: context.userId, targetUserId: target.id, action: parsed.data.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", details: { before: { isActive: target.isActive, status: target.status }, after: { isActive: parsed.data.isActive, status: parsed.data.isActive ? "ACTIVE" : "SUSPENDED" } } } })]);
  revalidatePath("/settings/admin"); return { success: true, message: parsed.data.isActive ? "계정을 활성화했습니다." : "계정을 비활성화했습니다." };
}

export async function resetManagedUserPasswordAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const context = await actorContext(); const parsed = resetManagedUserPasswordSchema.safeParse({ userId: formData.get("userId"), password: formData.get("password") });
  if (!context || !parsed.success) return parsed.success ? forbidden() : { success: false, message: "비밀번호는 8자 이상이어야 합니다." };
  const previewBlock = getRolePreviewWriteBlock(context); if (previewBlock) return previewBlock;
  const target = await targetInfo(parsed.data.userId, context);
  if (!target || !canManageTarget({ actorRole: context.role, actorUserId: context.userId, targetUserId: target.id, targetRole: target.targetRole, sameCompany: target.sameCompany })) return forbidden();
  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([prisma.user.update({ where: { id: target.id }, data: { passwordHash, sessionVersion: { increment: 1 } } }), prisma.auditLog.create({ data: { actorUserId: context.userId, targetUserId: target.id, action: "PASSWORD_RESET" } })]);
  return { success: true, message: "비밀번호를 초기화했습니다." };
}

export async function updateManagedUserRoleAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const context = await actorContext(); const parsed = managedUserRoleSchema.safeParse({ userId: formData.get("userId"), role: formData.get("role"), companyId: formData.get("companyId") || undefined });
  if (!context || !parsed.success) return forbidden();
  const previewBlock = getRolePreviewWriteBlock(context); if (previewBlock) return previewBlock;
  if (!canAssignRole(context.role, parsed.data.role)) return forbidden();
  const target = await targetInfo(parsed.data.userId, context);
  if (!target || !canManageTarget({ actorRole: context.role, actorUserId: context.userId, targetUserId: target.id, targetRole: target.targetRole, sameCompany: target.sameCompany })) return forbidden();
  const activeDeveloperCount = target.targetRole === "DEVELOPER" ? await prisma.user.count({ where: { systemRole: "DEVELOPER", isActive: true } }) : 0;
  if (!canChangeAccountRole({ isSelf: context.userId === target.id, currentRole: target.targetRole, nextRole: parsed.data.role, activeDeveloperCount })) return { success: false, message: target.id === context.userId ? "자기 역할은 변경할 수 없습니다." : "마지막 활성 개발자의 역할은 변경할 수 없습니다." };
  const companyId = parsed.data.companyId;
  if (!companyId || (context.role !== "DEVELOPER" && companyId !== context.activeCompanyId)) return forbidden();
  if (target.targetRole === "ADMIN" && parsed.data.role === "STAFF") {
    const otherAdminCount = await prisma.companyMembership.count({ where: { companyId, userId: { not: target.id }, role: "ADMIN", status: "ACTIVE", user: { status: "ACTIVE", isActive: true } } });
    if (!otherAdminCount) return { success: false, message: "마지막 관리자는 개발자 회원 상세 화면에서 새 관리자 지정 또는 회사 이용정지를 선택해 주세요." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { systemRole: "NONE", sessionVersion: { increment: 1 } } });
    await tx.companyMembership.deleteMany({ where: { userId: target.id } });
    await tx.staffAssignment.deleteMany({ where: { userId: target.id } });
    await tx.companyMembership.create({ data: { userId: target.id, companyId, role: parsed.data.role === "ADMIN" ? "ADMIN" : "STAFF" } });
    await tx.auditLog.create({ data: { actorUserId: context.userId, targetUserId: target.id, action: "USER_ROLE_CHANGED", details: { before: { role: target.targetRole, companyIds: target.memberships.map((item) => item.companyId) }, after: { role: parsed.data.role, companyId } } } });
  });
  revalidatePath("/settings/admin"); return { success: true, message: "역할을 변경했습니다." };
}

export async function updateStaffAssignmentsAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const context = await actorContext(); const parsed = staffAssignmentsSchema.safeParse({ userId: formData.get("userId"), companyId: formData.get("companyId"), propertyIds: formData.getAll("propertyIds"), roomIds: formData.getAll("roomIds") });
  if (!context || !parsed.success) return forbidden();
  const previewBlock = getRolePreviewWriteBlock(context); if (previewBlock) return previewBlock;
  if (context.role !== "DEVELOPER" && parsed.data.companyId !== context.activeCompanyId) return forbidden();
  const target = await targetInfo(parsed.data.userId, context);
  if (!target || target.targetRole !== "STAFF" || !canManageTarget({ actorRole: context.role, actorUserId: context.userId, targetUserId: target.id, targetRole: target.targetRole, sameCompany: target.sameCompany })) return forbidden();
  const rooms = await validateAssignments(parsed.data.companyId, parsed.data.propertyIds, parsed.data.roomIds);
  if (!rooms) return { success: false, message: "배정 범위가 회사와 일치하지 않습니다." };
  const previousAssignments = await prisma.staffAssignment.findMany({ where: { userId: target.id }, select: { propertyId: true, roomId: true } });
  await prisma.$transaction(async (tx) => { await tx.staffAssignment.deleteMany({ where: { userId: target.id } }); await tx.staffAssignment.createMany({ data: [...parsed.data.propertyIds.map((propertyId) => ({ userId: target.id, propertyId })), ...rooms.map((room) => ({ userId: target.id, roomId: room.id }))], skipDuplicates: true }); await tx.auditLog.create({ data: { actorUserId: context.userId, targetUserId: target.id, action: "STAFF_ASSIGNMENTS_CHANGED", details: { before: previousAssignments, after: { propertyIds: parsed.data.propertyIds, roomIds: parsed.data.roomIds } } } }); });
  revalidatePath("/settings/admin"); return { success: true, message: "직원 배정을 저장했습니다." };
}
