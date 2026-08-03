import { hasPermission } from "../../access-control/domain/access-control";
import {
  SIDEBAR_MENU_ITEMS,
  type SidebarMenuId,
} from "../../sidebar-preferences/domain/sidebar-menu";

export const STAFF_BOTTOM_NAVIGATION_SLOT_COUNT = 4;

export const STAFF_MOBILE_BOTTOM_NAVIGATION_ITEMS = SIDEBAR_MENU_ITEMS.filter((item) => (
  hasPermission("STAFF", item.requiredPermission)
));

export const STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS = STAFF_MOBILE_BOTTOM_NAVIGATION_ITEMS.map((item) => item.id);

export const DEFAULT_STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS = [
  "dashboard",
  "room-overview",
  "reservations",
  "room-status",
] as const satisfies readonly SidebarMenuId[];

export interface MobileNavigationPreferenceValue {
  itemOrder: SidebarMenuId[];
}

const allowedIds = new Set<SidebarMenuId>(STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS);

function normalizeIds(value: unknown): SidebarMenuId[] {
  if (!Array.isArray(value)) return [];
  const result: SidebarMenuId[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowedIds.has(item as SidebarMenuId)) continue;
    const id = item as SidebarMenuId;
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

export function normalizeStaffMobileNavigationPreference(input: { itemOrder?: unknown } | null | undefined): MobileNavigationPreferenceValue {
  const stored = normalizeIds(input?.itemOrder);
  const fallback = [
    ...DEFAULT_STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS,
    ...STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS,
  ];
  for (const id of fallback) {
    if (stored.length >= STAFF_BOTTOM_NAVIGATION_SLOT_COUNT) break;
    if (!stored.includes(id)) stored.push(id);
  }
  return { itemOrder: stored.slice(0, STAFF_BOTTOM_NAVIGATION_SLOT_COUNT) };
}

export function validateStaffMobileNavigationPreference(input: unknown): input is MobileNavigationPreferenceValue {
  if (!input || typeof input !== "object") return false;
  const itemOrder = (input as Partial<MobileNavigationPreferenceValue>).itemOrder;
  return Array.isArray(itemOrder)
    && itemOrder.length === STAFF_BOTTOM_NAVIGATION_SLOT_COUNT
    && new Set(itemOrder).size === STAFF_BOTTOM_NAVIGATION_SLOT_COUNT
    && itemOrder.every((id) => allowedIds.has(id));
}

export function canManageStaffMobileNavigationPreference(context: {
  actualRole: string;
  effectiveRole: string;
  isRoleSwitchActive: boolean;
}) {
  return context.actualRole === "DEVELOPER"
    && context.effectiveRole === "DEVELOPER"
    && !context.isRoleSwitchActive;
}
