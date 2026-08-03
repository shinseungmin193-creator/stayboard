import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAccessContext,
  hasPermission,
  PERMISSIONS,
  type AccessContext,
} from "@/features/access-control";
import {
  canManageStaffMobileDashboardPreference,
  DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE,
  normalizeStaffMobileDashboardPreference,
  validateStaffMobileDashboardPreference,
  type DashboardPreferenceValue,
} from "../domain/dashboard-preference";

export type DashboardPreferenceErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "COMPANY_UNAVAILABLE"
  | "INVALID_INPUT";

export class DashboardPreferenceError extends Error {
  constructor(public readonly code: DashboardPreferenceErrorCode) {
    super(code);
    this.name = "DashboardPreferenceError";
  }
}

function cloneDefault(): DashboardPreferenceValue {
  return {
    cardOrder: [...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.cardOrder],
    hiddenCardIds: [...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.hiddenCardIds],
  };
}

function auditValue(value: DashboardPreferenceValue): Prisma.InputJsonObject {
  return { cardOrder: value.cardOrder, hiddenCardIds: value.hiddenCardIds };
}

function assertManagementAccess(context: AccessContext | null, companyId: string) {
  if (!context) throw new DashboardPreferenceError("UNAUTHENTICATED");
  if (!canManageStaffMobileDashboardPreference(context)
    || !hasPermission(context.effectiveRole, PERMISSIONS.DEVELOPER_SETTINGS_MANAGE)) {
    throw new DashboardPreferenceError("FORBIDDEN");
  }
  if (!context.availableCompanies?.some((company) => company.id === companyId)) {
    throw new DashboardPreferenceError("COMPANY_UNAVAILABLE");
  }
  return context;
}

export async function getStaffMobileDashboardPreference(companyId: string): Promise<DashboardPreferenceValue> {
  const stored = await prisma.dashboardRolePreference.findUnique({
    where: { companyId_role_viewport: { companyId, role: "STAFF", viewport: "MOBILE" } },
    select: { cardOrder: true, hiddenCardIds: true },
  });
  return normalizeStaffMobileDashboardPreference(stored);
}

export async function saveStaffMobileDashboardPreference(
  companyId: string,
  value: DashboardPreferenceValue,
): Promise<DashboardPreferenceValue> {
  const context = assertManagementAccess(await getCurrentAccessContext(), companyId);
  if (!validateStaffMobileDashboardPreference(value)) throw new DashboardPreferenceError("INVALID_INPUT");

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirst({ where: { id: companyId, isActive: true }, select: { id: true } });
    if (!company) throw new DashboardPreferenceError("COMPANY_UNAVAILABLE");
    const current = await tx.dashboardRolePreference.findUnique({
      where: { companyId_role_viewport: { companyId, role: "STAFF", viewport: "MOBILE" } },
      select: { cardOrder: true, hiddenCardIds: true },
    });
    const before = normalizeStaffMobileDashboardPreference(current);
    const after = normalizeStaffMobileDashboardPreference(value);
    await tx.dashboardRolePreference.upsert({
      where: { companyId_role_viewport: { companyId, role: "STAFF", viewport: "MOBILE" } },
      create: {
        companyId,
        role: "STAFF",
        viewport: "MOBILE",
        cardOrder: after.cardOrder,
        hiddenCardIds: after.hiddenCardIds,
      },
      update: { cardOrder: after.cardOrder, hiddenCardIds: after.hiddenCardIds },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: companyId,
        action: "STAFF_MOBILE_DASHBOARD_PREFERENCE_UPDATED",
        details: { companyId, role: "STAFF", viewport: "MOBILE", before: auditValue(before), after: auditValue(after) },
      },
    });
    return after;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function resetStaffMobileDashboardPreference(companyId: string): Promise<DashboardPreferenceValue> {
  const context = assertManagementAccess(await getCurrentAccessContext(), companyId);
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirst({ where: { id: companyId, isActive: true }, select: { id: true } });
    if (!company) throw new DashboardPreferenceError("COMPANY_UNAVAILABLE");
    const current = await tx.dashboardRolePreference.findUnique({
      where: { companyId_role_viewport: { companyId, role: "STAFF", viewport: "MOBILE" } },
      select: { cardOrder: true, hiddenCardIds: true },
    });
    const before = normalizeStaffMobileDashboardPreference(current);
    const after = cloneDefault();
    await tx.dashboardRolePreference.deleteMany({ where: { companyId, role: "STAFF", viewport: "MOBILE" } });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: companyId,
        action: "STAFF_MOBILE_DASHBOARD_PREFERENCE_RESET",
        details: { companyId, role: "STAFF", viewport: "MOBILE", before: auditValue(before), after: auditValue(after) },
      },
    });
    return after;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
