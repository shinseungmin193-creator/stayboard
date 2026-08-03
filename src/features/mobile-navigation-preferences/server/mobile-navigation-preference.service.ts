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
  canManageStaffMobileNavigationPreference,
  DEFAULT_STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS,
  normalizeStaffMobileNavigationPreference,
  validateStaffMobileNavigationPreference,
  type MobileNavigationPreferenceValue,
} from "../domain/mobile-navigation-preference";

export type MobileNavigationPreferenceErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "COMPANY_UNAVAILABLE"
  | "INVALID_INPUT";

export class MobileNavigationPreferenceError extends Error {
  constructor(public readonly code: MobileNavigationPreferenceErrorCode) {
    super(code);
    this.name = "MobileNavigationPreferenceError";
  }
}

function cloneDefault(): MobileNavigationPreferenceValue {
  return { itemOrder: [...DEFAULT_STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS] };
}

function assertManagementAccess(context: AccessContext | null, companyId: string) {
  if (!context) throw new MobileNavigationPreferenceError("UNAUTHENTICATED");
  if (!canManageStaffMobileNavigationPreference(context)
    || !hasPermission(context.effectiveRole, PERMISSIONS.DEVELOPER_SETTINGS_MANAGE)) {
    throw new MobileNavigationPreferenceError("FORBIDDEN");
  }
  if (!context.availableCompanies?.some((company) => company.id === companyId)) {
    throw new MobileNavigationPreferenceError("COMPANY_UNAVAILABLE");
  }
  return context;
}

function assertReadAccess(context: AccessContext | null, companyId: string) {
  if (!context) throw new MobileNavigationPreferenceError("UNAUTHENTICATED");
  const isStaffForActiveCompany = context.effectiveRole === "STAFF"
    && context.activeCompanyId === companyId
    && context.allowedCompanyIds?.includes(companyId);
  const isDeveloperManager = canManageStaffMobileNavigationPreference(context)
    && hasPermission(context.effectiveRole, PERMISSIONS.DEVELOPER_SETTINGS_READ)
    && context.availableCompanies?.some((company) => company.id === companyId);
  if (!isStaffForActiveCompany && !isDeveloperManager) {
    throw new MobileNavigationPreferenceError("FORBIDDEN");
  }
}

export async function getStaffMobileNavigationPreference(companyId: string): Promise<MobileNavigationPreferenceValue> {
  assertReadAccess(await getCurrentAccessContext(), companyId);
  const stored = await prisma.mobileNavigationPreference.findUnique({
    where: { companyId_role: { companyId, role: "STAFF" } },
    select: { itemOrder: true },
  });
  return normalizeStaffMobileNavigationPreference(stored);
}

export async function saveStaffMobileNavigationPreference(
  companyId: string,
  value: MobileNavigationPreferenceValue,
): Promise<MobileNavigationPreferenceValue> {
  const context = assertManagementAccess(await getCurrentAccessContext(), companyId);
  if (!validateStaffMobileNavigationPreference(value)) throw new MobileNavigationPreferenceError("INVALID_INPUT");

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirst({ where: { id: companyId, isActive: true }, select: { id: true } });
    if (!company) throw new MobileNavigationPreferenceError("COMPANY_UNAVAILABLE");
    const current = await tx.mobileNavigationPreference.findUnique({
      where: { companyId_role: { companyId, role: "STAFF" } },
      select: { itemOrder: true },
    });
    const before = normalizeStaffMobileNavigationPreference(current);
    const after = normalizeStaffMobileNavigationPreference(value);
    await tx.mobileNavigationPreference.upsert({
      where: { companyId_role: { companyId, role: "STAFF" } },
      create: { companyId, role: "STAFF", itemOrder: after.itemOrder },
      update: { itemOrder: after.itemOrder },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: companyId,
        action: "STAFF_MOBILE_NAVIGATION_PREFERENCE_UPDATED",
        details: { companyId, role: "STAFF", before: { itemOrder: before.itemOrder }, after: { itemOrder: after.itemOrder } },
      },
    });
    return after;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function resetStaffMobileNavigationPreference(companyId: string): Promise<MobileNavigationPreferenceValue> {
  const context = assertManagementAccess(await getCurrentAccessContext(), companyId);
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirst({ where: { id: companyId, isActive: true }, select: { id: true } });
    if (!company) throw new MobileNavigationPreferenceError("COMPANY_UNAVAILABLE");
    const current = await tx.mobileNavigationPreference.findUnique({
      where: { companyId_role: { companyId, role: "STAFF" } },
      select: { itemOrder: true },
    });
    const before = normalizeStaffMobileNavigationPreference(current);
    const after = cloneDefault();
    await tx.mobileNavigationPreference.deleteMany({ where: { companyId, role: "STAFF" } });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: companyId,
        action: "STAFF_MOBILE_NAVIGATION_PREFERENCE_RESET",
        details: { companyId, role: "STAFF", before: { itemOrder: before.itemOrder }, after: { itemOrder: after.itemOrder } },
      },
    });
    return after;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
