import { hasPermission, isUserRole, USER_ROLES, type Permission, type UserRole } from "../../access-control/domain/access-control";
import { DEFAULT_SIDEBAR_MENU_ORDER, isDeveloperRequiredSidebarMenu, isSidebarMenuHideable, isSidebarMenuId, SIDEBAR_MENU_ITEMS, type SidebarMenuDefinition, type SidebarMenuId } from "./sidebar-menu";

export type SidebarMenuOrderItem = { type: "MENU"; key: SidebarMenuId };
export type SidebarDividerOrderItem = { type: "DIVIDER"; id: string };
export type SidebarOrderItem = SidebarMenuOrderItem | SidebarDividerOrderItem;
export type SidebarOrderItemId = SidebarMenuId | string;
export type SidebarMenuAllowedRoles = Record<SidebarMenuId, UserRole[]>;
export type SidebarNavigationItem<T extends SidebarMenuDefinition = SidebarMenuDefinition> = { type: "MENU"; menu: T } | SidebarDividerOrderItem;

export interface SidebarPreferenceValue {
  menuOrder: SidebarOrderItem[];
  hiddenMenuIds: SidebarMenuId[];
  customLabels: Partial<Record<SidebarMenuId, string>>;
  allowedRoles: SidebarMenuAllowedRoles;
}

export const DEFAULT_SIDEBAR_ITEM_ORDER: readonly SidebarOrderItem[] = [
  { type: "MENU", key: "room-overview" },
  { type: "MENU", key: "room-status" },
  { type: "MENU", key: "dashboard" },
  { type: "MENU", key: "reservations" },
  { type: "MENU", key: "reservation-conflicts" },
  { type: "DIVIDER", id: "divider:default-operations" },
  { type: "MENU", key: "properties" },
  { type: "MENU", key: "rooms" },
  { type: "MENU", key: "calendar-sources" },
  { type: "DIVIDER", id: "divider:default-management" },
  { type: "MENU", key: "occupancy-statistics" },
  { type: "MENU", key: "cleaning" },
  { type: "MENU", key: "room-notes" },
  { type: "MENU", key: "property-reviews" },
  { type: "DIVIDER", id: "divider:default-work" },
  { type: "MENU", key: "member-management" },
  { type: "MENU", key: "admin-settings" },
  { type: "MENU", key: "developer-settings" },
  { type: "MENU", key: "developer-users" },
  { type: "MENU", key: "developer-companies" },
  { type: "MENU", key: "developer-audit-logs" },
  { type: "MENU", key: "developer-error-logs" },
];

export const DEFAULT_SIDEBAR_MENU_ALLOWED_ROLES = Object.fromEntries(SIDEBAR_MENU_ITEMS.map((menu) => [
  menu.id,
  USER_ROLES.filter((role) => hasPermission(role, menu.requiredPermission)),
])) as SidebarMenuAllowedRoles;

const cloneDefaultSidebarItemOrder = (): SidebarOrderItem[] => DEFAULT_SIDEBAR_ITEM_ORDER.map((item) => ({ ...item }));

export const DEFAULT_SIDEBAR_PREFERENCE: SidebarPreferenceValue = {
  menuOrder: cloneDefaultSidebarItemOrder(),
  hiddenMenuIds: [],
  customLabels: {},
  allowedRoles: structuredClone(DEFAULT_SIDEBAR_MENU_ALLOWED_ROLES),
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function isSidebarDividerId(value: unknown): value is string {
  return typeof value === "string" && /^divider:[a-zA-Z0-9_-]{1,100}$/.test(value);
}

export function getSidebarOrderItemId(item: SidebarOrderItem): SidebarOrderItemId {
  return item.type === "MENU" ? item.key : item.id;
}

function menuItem(key: SidebarMenuId): SidebarMenuOrderItem {
  return { type: "MENU", key };
}

// Migration-only map for the former category model. Runtime rendering never
// reads these sections; after normalization the divider positions are explicit.
const LEGACY_SECTIONS: readonly (readonly SidebarMenuId[])[] = [
  ["dashboard", "room-overview", "room-status", "reservations", "cleaning", "reservation-conflicts"],
  ["properties", "rooms", "room-notes", "calendar-sources", "member-management"],
  ["occupancy-statistics", "property-reviews"],
  ["admin-settings"],
  ["developer-settings", "developer-users", "developer-companies", "developer-audit-logs", "developer-error-logs"],
];
const legacySectionByMenuId = new Map(LEGACY_SECTIONS.flatMap((menuIds, sectionIndex) => menuIds.map((menuId) => [menuId, sectionIndex] as const)));

function migrateLegacyMenuOrder(value: readonly unknown[]): SidebarOrderItem[] {
  const savedMenuIds = [...new Set(value.filter(isSidebarMenuId))];
  if (!savedMenuIds.length) return cloneDefaultSidebarItemOrder();
  const completeMenuIds = [...savedMenuIds, ...DEFAULT_SIDEBAR_MENU_ORDER.filter((menuId) => !savedMenuIds.includes(menuId))];
  const items: SidebarOrderItem[] = [];
  completeMenuIds.forEach((menuId, index) => {
    items.push(menuItem(menuId));
    const nextMenuId = completeMenuIds[index + 1];
    if (nextMenuId && legacySectionByMenuId.get(menuId) !== legacySectionByMenuId.get(nextMenuId)) {
      items.push({ type: "DIVIDER", id: `divider:legacy-${index}-${menuId}` });
    }
  });
  return items;
}

function normalizeMenuOrder(value: unknown): SidebarOrderItem[] {
  if (!Array.isArray(value) || value.length === 0) return cloneDefaultSidebarItemOrder();
  if (value.every((item) => typeof item === "string")) return migrateLegacyMenuOrder(value);

  const seenMenuIds = new Set<SidebarMenuId>();
  const seenDividerIds = new Set<string>();
  const items: SidebarOrderItem[] = [];
  for (const rawItem of value) {
    if (typeof rawItem === "string" && isSidebarMenuId(rawItem) && !seenMenuIds.has(rawItem)) {
      seenMenuIds.add(rawItem);
      items.push(menuItem(rawItem));
      continue;
    }
    if (!isRecord(rawItem)) continue;
    if (rawItem.type === "MENU" && isSidebarMenuId(rawItem.key) && !seenMenuIds.has(rawItem.key)) {
      seenMenuIds.add(rawItem.key);
      items.push(menuItem(rawItem.key));
      continue;
    }
    if (rawItem.type === "DIVIDER" && isSidebarDividerId(rawItem.id) && !seenDividerIds.has(rawItem.id)) {
      seenDividerIds.add(rawItem.id);
      items.push({ type: "DIVIDER", id: rawItem.id });
    }
  }
  for (const menuId of DEFAULT_SIDEBAR_MENU_ORDER) {
    if (!seenMenuIds.has(menuId)) items.push(menuItem(menuId));
  }
  return items.some((item) => item.type === "MENU") ? items : cloneDefaultSidebarItemOrder();
}

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

export function normalizeSidebarMenuAllowedRoles(value: unknown): SidebarMenuAllowedRoles {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(SIDEBAR_MENU_ITEMS.map((menu) => {
    const rawRoles = record[menu.id];
    const configured: UserRole[] = Array.isArray(rawRoles) ? rawRoles.filter((role): role is UserRole => isUserRole(role)) : DEFAULT_SIDEBAR_MENU_ALLOWED_ROLES[menu.id];
    const allowed = USER_ROLES.filter((role) => configured.includes(role) && hasPermission(role, menu.requiredPermission));
    if (isDeveloperRequiredSidebarMenu(menu.id) && !allowed.includes("DEVELOPER")) allowed.unshift("DEVELOPER");
    return [menu.id, allowed];
  })) as SidebarMenuAllowedRoles;
}

export function normalizeSidebarPreference(value: unknown): SidebarPreferenceValue {
  const record = isRecord(value) ? value : {};
  return {
    menuOrder: normalizeMenuOrder(record.menuOrder),
    hiddenMenuIds: normalizeMenuIds(record.hiddenMenuIds).filter(isSidebarMenuHideable),
    customLabels: normalizeCustomLabels(record.customLabels),
    allowedRoles: normalizeSidebarMenuAllowedRoles(record.allowedRoles),
  };
}

export function getSidebarMenuLabel(menu: SidebarMenuDefinition, preference: SidebarPreferenceValue): string {
  return preference.customLabels[menu.id as SidebarMenuId] ?? menu.label;
}

export function orderSidebarMenus<T extends SidebarMenuDefinition>(items: readonly T[], preference: SidebarPreferenceValue): T[] {
  const positions = new Map(preference.menuOrder.flatMap((item, index) => item.type === "MENU" ? [[item.key, index] as const] : []));
  return [...items].sort((left, right) => (positions.get(left.id as SidebarMenuId) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id as SidebarMenuId) ?? Number.MAX_SAFE_INTEGER));
}

export function moveSidebarItem(order: readonly SidebarOrderItem[], activeId: SidebarOrderItemId, overId: SidebarOrderItemId): SidebarOrderItem[] {
  const result = structuredClone(order) as SidebarOrderItem[];
  const oldIndex = result.findIndex((item) => getSidebarOrderItemId(item) === activeId);
  const newIndex = result.findIndex((item) => getSidebarOrderItemId(item) === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return result;
  const [movedItem] = result.splice(oldIndex, 1);
  result.splice(newIndex, 0, movedItem);
  return result;
}

export function addSidebarDivider(order: readonly SidebarOrderItem[], dividerId: string): SidebarOrderItem[] {
  if (!isSidebarDividerId(dividerId) || order.some((item) => getSidebarOrderItemId(item) === dividerId)) return order.map((item) => ({ ...item }));
  const result = structuredClone(order) as SidebarOrderItem[];
  result.splice(Math.max(0, result.length - 1), 0, { type: "DIVIDER", id: dividerId });
  return result;
}

export function removeSidebarDivider(order: readonly SidebarOrderItem[], dividerId: string): SidebarOrderItem[] {
  return order.filter((item) => item.type !== "DIVIDER" || item.id !== dividerId);
}

export function getOrderedSidebarItems<T extends SidebarMenuDefinition>(items: readonly T[], preference: SidebarPreferenceValue): SidebarNavigationItem<T>[] {
  const menusById = new Map(items.map((item) => [item.id, item]));
  return preference.menuOrder.flatMap<SidebarNavigationItem<T>>((item) => {
    if (item.type === "DIVIDER") return [item];
    const menu = menusById.get(item.key);
    return menu ? [{ type: "MENU" as const, menu }] : [];
  });
}

export function normalizeSidebarItemsForRender<T extends SidebarMenuDefinition>(items: readonly SidebarNavigationItem<T>[]): SidebarNavigationItem<T>[] {
  const result: SidebarNavigationItem<T>[] = [];
  let hasVisibleMenu = false;
  let pendingDivider: SidebarDividerOrderItem | null = null;
  for (const item of items) {
    if (item.type === "DIVIDER") {
      if (hasVisibleMenu && !pendingDivider) pendingDivider = item;
      continue;
    }
    if (pendingDivider) {
      result.push(pendingDivider);
      pendingDivider = null;
    }
    result.push(item);
    hasVisibleMenu = true;
  }
  return result;
}

export function getSidebarNavigationItems<T extends SidebarMenuDefinition>(items: readonly T[], preference: SidebarPreferenceValue, isVisible: (menu: T) => boolean): SidebarNavigationItem<T>[] {
  return normalizeSidebarItemsForRender(getOrderedSidebarItems(items, preference).filter((item) => item.type === "DIVIDER" || isVisible(item.menu)));
}

export function getAuthorizedSidebarItems<T extends SidebarMenuDefinition>(items: readonly T[], preference: SidebarPreferenceValue, role: UserRole): SidebarNavigationItem<T>[] {
  return getSidebarNavigationItems(items, preference, (item) => canAccessSidebarMenu(role, item.id as SidebarMenuId, preference.allowedRoles) && !preference.hiddenMenuIds.includes(item.id as SidebarMenuId));
}

export function getAuthorizedSidebarMenus<T extends SidebarMenuDefinition>(items: readonly T[], preference: SidebarPreferenceValue, role: UserRole): T[] {
  return getAuthorizedSidebarItems(items, preference, role).flatMap((item) => item.type === "MENU" ? [item.menu] : []);
}

export function canAccessSidebarMenu(role: UserRole, menuId: SidebarMenuId, allowedRoles: SidebarMenuAllowedRoles) {
  const menu = SIDEBAR_MENU_ITEMS.find((item) => item.id === menuId);
  return Boolean(menu && hasPermission(role, menu.requiredPermission) && allowedRoles[menuId]?.includes(role));
}

export function isSidebarPermissionAllowed(role: UserRole, permission: Permission, allowedRoles: SidebarMenuAllowedRoles) {
  if (!hasPermission(role, permission)) return false;
  const relatedMenus = SIDEBAR_MENU_ITEMS.filter((menu) => menu.relatedPermissions.includes(permission as never));
  if (!relatedMenus.length) return true;
  return relatedMenus.some((menu) => canAccessSidebarMenu(role, menu.id, allowedRoles));
}

export function canConfigureSidebarMenuRole(menuId: SidebarMenuId, role: UserRole) {
  const menu = SIDEBAR_MENU_ITEMS.find((item) => item.id === menuId);
  if (!menu || !hasPermission(role, menu.requiredPermission)) return false;
  return !(role === "DEVELOPER" && isDeveloperRequiredSidebarMenu(menuId));
}
