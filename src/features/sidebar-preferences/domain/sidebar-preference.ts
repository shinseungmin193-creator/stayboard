import { DEFAULT_SIDEBAR_MENU_ORDER, isSidebarMenuHideable, isSidebarMenuId, SIDEBAR_MENU_ITEMS, type SidebarMenuDefinition, type SidebarMenuId } from "./sidebar-menu";
import { hasPermission, type UserRole } from "../../access-control/domain/access-control";

export interface SidebarPreferenceValue {
  menuOrder: SidebarMenuId[];
  hiddenMenuIds: SidebarMenuId[];
  customLabels: Partial<Record<SidebarMenuId, string>>;
}

export const DEFAULT_SIDEBAR_PREFERENCE: SidebarPreferenceValue = {
  menuOrder: [...DEFAULT_SIDEBAR_MENU_ORDER],
  hiddenMenuIds: [],
  customLabels: {},
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function normalizeMenuIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isSidebarMenuId))];
}

function normalizeCustomLabels(value: unknown): Partial<Record<SidebarMenuId, string>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([menuId, label]) => {
    if (!isSidebarMenuId(menuId) || typeof label !== "string") return [];
    const normalizedLabel = label.trim();
    const menu = SIDEBAR_MENU_ITEMS.find((item) => item.id === menuId);
    if (!normalizedLabel || normalizedLabel.length > 20 || normalizedLabel === menu?.label) return [];
    return [[menuId, normalizedLabel]];
  })) as Partial<Record<SidebarMenuId, string>>;
}

export function normalizeSidebarPreference(value: unknown): SidebarPreferenceValue {
  const record = isRecord(value) ? value : {};
  const savedOrder = normalizeMenuIds(record.menuOrder);
  const missingMenuIds = DEFAULT_SIDEBAR_MENU_ORDER.filter((menuId) => !savedOrder.includes(menuId));
  return {
    menuOrder: [...savedOrder, ...missingMenuIds],
    hiddenMenuIds: normalizeMenuIds(record.hiddenMenuIds).filter(isSidebarMenuHideable),
    customLabels: normalizeCustomLabels(record.customLabels),
  };
}

export function getSidebarMenuLabel(menu: SidebarMenuDefinition, preference: SidebarPreferenceValue): string {
  return preference.customLabels[menu.id as SidebarMenuId] ?? menu.label;
}

export function orderSidebarMenus<T extends SidebarMenuDefinition>(items: readonly T[], preference: SidebarPreferenceValue): T[] {
  const positions = new Map(preference.menuOrder.map((menuId, index) => [menuId, index]));
  return [...items].sort((left, right) => (positions.get(left.id as SidebarMenuId) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id as SidebarMenuId) ?? Number.MAX_SAFE_INTEGER));
}

export function moveSidebarMenu(order: readonly SidebarMenuId[], activeId: SidebarMenuId, overId: SidebarMenuId): SidebarMenuId[] {
  if (!isSidebarMenuHideable(activeId) || !isSidebarMenuHideable(overId)) return [...order];
  const movableMenuIds = order.filter(isSidebarMenuHideable);
  const oldIndex = movableMenuIds.indexOf(activeId);
  const newIndex = movableMenuIds.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return [...order];
  const [movedMenuId] = movableMenuIds.splice(oldIndex, 1);
  movableMenuIds.splice(newIndex, 0, movedMenuId);
  let movableIndex = 0;
  return order.map((menuId) => isSidebarMenuHideable(menuId) ? movableMenuIds[movableIndex++] : menuId);
}

export function getAuthorizedSidebarMenus<T extends SidebarMenuDefinition>(items: readonly T[], preference: SidebarPreferenceValue, role: UserRole): T[] {
  return orderSidebarMenus(items, preference).filter((item) => (
    hasPermission(role, item.requiredPermission) && !preference.hiddenMenuIds.includes(item.id as SidebarMenuId)
  ));
}
