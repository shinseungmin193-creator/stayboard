import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSidebarPreference, type SidebarPreferenceValue } from "../domain/sidebar-preference";
import { findSidebarMenuAllowedRoles, GLOBAL_SIDEBAR_MENU_POLICY_ID } from "./sidebar-menu-policy.repository";

const sidebarPreferenceSelect = { menuOrder: true, hiddenMenuIds: true, customLabels: true } as const;

export async function findSidebarPreference(userId: string): Promise<SidebarPreferenceValue> {
  const [preference, allowedRoles] = await Promise.all([
    prisma.sidebarPreference.findUnique({ where: { userId }, select: sidebarPreferenceSelect }),
    findSidebarMenuAllowedRoles(),
  ]);
  return normalizeSidebarPreference({ ...preference, allowedRoles });
}

export async function upsertSidebarPreference(userId: string, value: SidebarPreferenceValue): Promise<SidebarPreferenceValue> {
  const preference = normalizeSidebarPreference(value);
  return prisma.$transaction(async (tx) => {
    const [currentPolicy, saved] = await Promise.all([
      tx.sidebarMenuPolicy.findUnique({ where: { id: GLOBAL_SIDEBAR_MENU_POLICY_ID }, select: { allowedRoles: true } }),
      tx.sidebarPreference.upsert({
        where: { userId },
        create: { userId, menuOrder: preference.menuOrder, hiddenMenuIds: preference.hiddenMenuIds, customLabels: preference.customLabels },
        update: { menuOrder: preference.menuOrder, hiddenMenuIds: preference.hiddenMenuIds, customLabels: preference.customLabels },
        select: sidebarPreferenceSelect,
      }),
    ]);
    const before = normalizeSidebarPreference({ allowedRoles: currentPolicy?.allowedRoles }).allowedRoles;
    await tx.sidebarMenuPolicy.upsert({
      where: { id: GLOBAL_SIDEBAR_MENU_POLICY_ID },
      create: { id: GLOBAL_SIDEBAR_MENU_POLICY_ID, allowedRoles: preference.allowedRoles },
      update: { allowedRoles: preference.allowedRoles },
    });
    if (JSON.stringify(before) !== JSON.stringify(preference.allowedRoles)) {
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: "SIDEBAR_MENU_ROLE_POLICY_UPDATED",
          details: { before, after: preference.allowedRoles },
        },
      });
    }
    return normalizeSidebarPreference({ ...saved, allowedRoles: preference.allowedRoles });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
