import "server-only";

import { prisma } from "@/lib/prisma";
import { normalizeSidebarPreference, type SidebarPreferenceValue } from "../domain/sidebar-preference";

const sidebarPreferenceSelect = { menuOrder: true, hiddenMenuIds: true, customLabels: true } as const;

export async function findSidebarPreference(userId: string): Promise<SidebarPreferenceValue> {
  const preference = await prisma.sidebarPreference.findUnique({ where: { userId }, select: sidebarPreferenceSelect });
  return normalizeSidebarPreference(preference);
}

export async function upsertSidebarPreference(userId: string, value: SidebarPreferenceValue): Promise<SidebarPreferenceValue> {
  const preference = normalizeSidebarPreference(value);
  const saved = await prisma.sidebarPreference.upsert({
    where: { userId },
    create: { userId, menuOrder: preference.menuOrder, hiddenMenuIds: preference.hiddenMenuIds, customLabels: preference.customLabels },
    update: { menuOrder: preference.menuOrder, hiddenMenuIds: preference.hiddenMenuIds, customLabels: preference.customLabels },
    select: sidebarPreferenceSelect,
  });
  return normalizeSidebarPreference(saved);
}
