import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertLastAdminResolution,
  assertMutableUserTarget,
  assertSafeAuditMetadata,
  DeveloperManagementPolicyError,
  type LastAdminResolution,
} from "./domain/developer-management-policy";

type Transaction = Prisma.TransactionClient;

interface LastAdminInput {
  actorUserId: string;
  targetUserId: string;
  companyIds: readonly string[];
  resolution: LastAdminResolution;
  replacementUserId?: string | null;
  reason: string;
}

async function createAuditLog(
  tx: Transaction,
  data: {
    actorUserId: string;
    targetUserId?: string;
    targetCompanyId?: string;
    action: string;
    reason?: string;
    details?: Prisma.InputJsonValue;
  },
) {
  assertSafeAuditMetadata(data.details);
  await tx.auditLog.create({ data });
}

async function getMutableTarget(tx: Transaction, actorUserId: string, targetUserId: string) {
  const target = await tx.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      username: true,
      systemRole: true,
      status: true,
      isActive: true,
      memberships: {
        select: { id: true, companyId: true, role: true, status: true, company: { select: { isActive: true } } },
      },
    },
  });
  if (!target) throw new DeveloperManagementPolicyError("INVALID_STATE", "회원을 찾을 수 없습니다.");
  assertMutableUserTarget({ actorUserId, targetUserId: target.id, targetSystemRole: target.systemRole });
  return target;
}

async function findLastAdminCompanyIds(tx: Transaction, target: Awaited<ReturnType<typeof getMutableTarget>>) {
  const adminCompanyIds = target.memberships
    .filter((membership) => membership.role === "ADMIN" && membership.status === "ACTIVE" && membership.company.isActive)
    .map((membership) => membership.companyId);
  const results = await Promise.all(
    adminCompanyIds.map(async (companyId) => ({
      companyId,
      count: await tx.companyMembership.count({
        where: {
          companyId,
          userId: { not: target.id },
          role: "ADMIN",
          status: "ACTIVE",
          user: { status: "ACTIVE", isActive: true },
        },
      }),
    })),
  );
  return results.filter((result) => result.count === 0).map((result) => result.companyId);
}

async function resolveLastAdminCompanies(tx: Transaction, input: LastAdminInput) {
  assertLastAdminResolution({
    lastAdminCompanyIds: input.companyIds,
    resolution: input.resolution,
    replacementUserId: input.replacementUserId,
  });
  if (!input.companyIds.length) return;
  if (input.resolution === "TRANSFER") {
    const replacements = await tx.companyMembership.findMany({
      where: {
        companyId: { in: [...input.companyIds] },
        userId: input.replacementUserId!,
        role: "STAFF",
        status: "ACTIVE",
        user: { status: "ACTIVE", isActive: true, systemRole: "NONE" },
      },
      select: { id: true, companyId: true, userId: true, role: true },
    });
    if (replacements.length !== new Set(input.companyIds).size) {
      throw new DeveloperManagementPolicyError("INVALID_REPLACEMENT", "모든 대상 회사에 소속된 활성 직원을 새 관리자로 선택해 주세요.");
    }
    for (const replacement of replacements) {
      await tx.companyMembership.update({ where: { id: replacement.id }, data: { role: "ADMIN" } });
      await tx.propertyAccess.deleteMany({ where: { membershipId: replacement.id } });
      await createAuditLog(tx, {
        actorUserId: input.actorUserId,
        targetUserId: replacement.userId,
        targetCompanyId: replacement.companyId,
        action: "COMPANY_ADMIN_TRANSFERRED",
        reason: input.reason,
        details: { before: { role: replacement.role }, after: { role: "ADMIN" }, previousAdminUserId: input.targetUserId },
      });
    }
    await tx.user.update({ where: { id: input.replacementUserId! }, data: { sessionVersion: { increment: 1 } } });
    return;
  }
  if (input.resolution === "SUSPEND_COMPANY") {
    const suspendedAt = new Date();
    for (const companyId of input.companyIds) {
      await tx.company.update({
        where: { id: companyId },
        data: { isActive: false, suspendedAt, suspendedById: input.actorUserId, suspensionReason: input.reason },
      });
      await createAuditLog(tx, {
        actorUserId: input.actorUserId,
        targetCompanyId: companyId,
        action: "COMPANY_SUSPENDED",
        reason: input.reason,
        details: { before: { isActive: true }, after: { isActive: false }, lastAdminUserId: input.targetUserId },
      });
    }
  }
}

export async function suspendUser(input: {
  actorUserId: string;
  userId: string;
  reason: string;
  lastAdminResolution: LastAdminResolution;
  replacementUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await getMutableTarget(tx, input.actorUserId, input.userId);
    if (target.status !== "ACTIVE") throw new DeveloperManagementPolicyError("INVALID_STATE", "정상 상태의 회원만 이용정지할 수 있습니다.");
    const lastAdminCompanyIds = await findLastAdminCompanyIds(tx, target);
    await resolveLastAdminCompanies(tx, {
      actorUserId: input.actorUserId,
      targetUserId: target.id,
      companyIds: lastAdminCompanyIds,
      resolution: input.lastAdminResolution,
      replacementUserId: input.replacementUserId,
      reason: input.reason,
    });
    const suspendedAt = new Date();
    await tx.user.update({
      where: { id: target.id },
      data: {
        status: "SUSPENDED",
        isActive: false,
        suspendedAt,
        suspendedById: input.actorUserId,
        suspensionReason: input.reason,
        sessionVersion: { increment: 1 },
      },
    });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetUserId: target.id,
      action: "USER_SUSPENDED",
      reason: input.reason,
      details: { before: { status: target.status }, after: { status: "SUSPENDED" } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function restoreUser(input: { actorUserId: string; userId: string; reason?: string }) {
  return prisma.$transaction(async (tx) => {
    const target = await getMutableTarget(tx, input.actorUserId, input.userId);
    if (target.status !== "SUSPENDED") throw new DeveloperManagementPolicyError("INVALID_STATE", "이용정지 회원만 정지 해제할 수 있습니다.");
    await tx.user.update({
      where: { id: target.id },
      data: {
        status: "ACTIVE",
        isActive: true,
        suspendedAt: null,
        suspendedById: null,
        suspensionReason: null,
        sessionVersion: { increment: 1 },
      },
    });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetUserId: target.id,
      action: "USER_RESTORED",
      reason: input.reason || undefined,
      details: { before: { status: target.status }, after: { status: "ACTIVE" } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function forceLogoutUser(input: { actorUserId: string; userId: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const target = await getMutableTarget(tx, input.actorUserId, input.userId);
    await tx.user.update({ where: { id: target.id }, data: { sessionVersion: { increment: 1 } } });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetUserId: target.id,
      action: "USER_FORCE_LOGOUT",
      reason: input.reason,
      details: { status: target.status },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function softDeleteUser(input: {
  actorUserId: string;
  userId: string;
  confirmation: string;
  reason: string;
  lastAdminResolution: LastAdminResolution;
  replacementUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await getMutableTarget(tx, input.actorUserId, input.userId);
    if (target.status === "DELETED") throw new DeveloperManagementPolicyError("INVALID_STATE", "이미 탈퇴 처리된 회원입니다.");
    const normalizedConfirmation = input.confirmation.trim().toLowerCase();
    if (![target.email.toLowerCase(), target.username?.toLowerCase()].filter(Boolean).includes(normalizedConfirmation)) {
      throw new DeveloperManagementPolicyError("INVALID_STATE", "회원 이메일 또는 username 확인값이 일치하지 않습니다.");
    }
    const lastAdminCompanyIds = await findLastAdminCompanyIds(tx, target);
    await resolveLastAdminCompanies(tx, {
      actorUserId: input.actorUserId,
      targetUserId: target.id,
      companyIds: lastAdminCompanyIds,
      resolution: input.lastAdminResolution,
      replacementUserId: input.replacementUserId,
      reason: input.reason,
    });
    await tx.user.update({
      where: { id: target.id },
      data: {
        status: "DELETED",
        isActive: false,
        deletedAt: new Date(),
        deletedById: input.actorUserId,
        deletionReason: input.reason,
        sessionVersion: { increment: 1 },
      },
    });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetUserId: target.id,
      action: "USER_DELETED",
      reason: input.reason,
      details: { before: { status: target.status }, after: { status: "DELETED" } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function anonymizeDeletedUser(input: {
  actorUserId: string;
  userId: string;
  confirmation: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await getMutableTarget(tx, input.actorUserId, input.userId);
    if (target.status !== "DELETED") throw new DeveloperManagementPolicyError("INVALID_STATE", "탈퇴 상태의 회원만 익명화할 수 있습니다.");
    if (target.email.toLowerCase() !== input.confirmation.trim().toLowerCase() && target.username?.toLowerCase() !== input.confirmation.trim().toLowerCase()) {
      throw new DeveloperManagementPolicyError("INVALID_STATE", "회원 이메일 또는 username 확인값이 일치하지 않습니다.");
    }
    await tx.user.update({
      where: { id: target.id },
      data: {
        name: "탈퇴한 사용자",
        email: `deleted-${target.id}@deleted.local`,
        username: `deleted-${target.id}`,
        passwordHash: null,
        anonymizedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetUserId: target.id,
      action: "USER_ANONYMIZED",
      reason: input.reason,
      details: { status: "DELETED", anonymized: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function changeUserRole(input: {
  actorUserId: string;
  userId: string;
  companyId: string;
  role: "ADMIN" | "STAFF";
  reason: string;
  lastAdminResolution: LastAdminResolution;
  replacementUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await getMutableTarget(tx, input.actorUserId, input.userId);
    if (target.status !== "ACTIVE") throw new DeveloperManagementPolicyError("INVALID_STATE", "정상 상태의 회원만 권한을 변경할 수 있습니다.");
    const membership = target.memberships.find((item) => item.companyId === input.companyId && item.status === "ACTIVE");
    if (!membership) throw new DeveloperManagementPolicyError("INVALID_STATE", "활성 회사 소속을 찾을 수 없습니다.");
    if (membership.role === input.role) throw new DeveloperManagementPolicyError("INVALID_STATE", "이미 요청한 권한입니다.");
    if (membership.role === "ADMIN" && input.role === "STAFF") {
      const otherAdminCount = await tx.companyMembership.count({
        where: {
          companyId: input.companyId,
          userId: { not: target.id },
          role: "ADMIN",
          status: "ACTIVE",
          user: { status: "ACTIVE", isActive: true },
        },
      });
      await resolveLastAdminCompanies(tx, {
        actorUserId: input.actorUserId,
        targetUserId: target.id,
        companyIds: otherAdminCount ? [] : [input.companyId],
        resolution: input.lastAdminResolution,
        replacementUserId: input.replacementUserId,
        reason: input.reason,
      });
    }
    await tx.companyMembership.update({ where: { id: membership.id }, data: { role: input.role } });
    if (input.role === "ADMIN") await tx.propertyAccess.deleteMany({ where: { membershipId: membership.id } });
    await tx.user.update({ where: { id: target.id }, data: { sessionVersion: { increment: 1 } } });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetUserId: target.id,
      targetCompanyId: input.companyId,
      action: "USER_ROLE_CHANGED",
      reason: input.reason,
      details: { before: { role: membership.role }, after: { role: input.role } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function suspendCompany(input: { actorUserId: string; companyId: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: input.companyId }, select: { id: true, isActive: true } });
    if (!company) throw new DeveloperManagementPolicyError("INVALID_STATE", "회사를 찾을 수 없습니다.");
    if (!company.isActive) throw new DeveloperManagementPolicyError("INVALID_STATE", "이미 이용정지된 회사입니다.");
    await tx.company.update({
      where: { id: company.id },
      data: { isActive: false, suspendedAt: new Date(), suspendedById: input.actorUserId, suspensionReason: input.reason },
    });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetCompanyId: company.id,
      action: "COMPANY_SUSPENDED",
      reason: input.reason,
      details: { before: { isActive: true }, after: { isActive: false } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function restoreCompany(input: { actorUserId: string; companyId: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: input.companyId }, select: { id: true, isActive: true } });
    if (!company) throw new DeveloperManagementPolicyError("INVALID_STATE", "회사를 찾을 수 없습니다.");
    if (company.isActive) throw new DeveloperManagementPolicyError("INVALID_STATE", "이미 정상 상태인 회사입니다.");
    await tx.company.update({
      where: { id: company.id },
      data: { isActive: true, suspendedAt: null, suspendedById: null, suspensionReason: null },
    });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetCompanyId: company.id,
      action: "COMPANY_RESTORED",
      reason: input.reason,
      details: { before: { isActive: false }, after: { isActive: true } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function transferCompanyAdmin(input: {
  actorUserId: string;
  companyId: string;
  replacementUserId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.companyMembership.findFirst({
      where: {
        companyId: input.companyId,
        userId: input.replacementUserId,
        role: "STAFF",
        status: "ACTIVE",
        user: { status: "ACTIVE", isActive: true, systemRole: "NONE" },
      },
      select: { id: true, userId: true, role: true },
    });
    if (!membership) throw new DeveloperManagementPolicyError("INVALID_REPLACEMENT", "활성 직원을 새 관리자로 선택해 주세요.");
    await tx.companyMembership.update({ where: { id: membership.id }, data: { role: "ADMIN" } });
    await tx.propertyAccess.deleteMany({ where: { membershipId: membership.id } });
    await tx.user.update({ where: { id: membership.userId }, data: { sessionVersion: { increment: 1 } } });
    await createAuditLog(tx, {
      actorUserId: input.actorUserId,
      targetUserId: membership.userId,
      targetCompanyId: input.companyId,
      action: "COMPANY_ADMIN_TRANSFERRED",
      reason: input.reason,
      details: { before: { role: membership.role }, after: { role: "ADMIN" } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
