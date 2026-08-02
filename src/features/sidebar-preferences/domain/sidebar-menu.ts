import type { LucideIcon } from "lucide-react";
import { BedDouble, Bug, Building2, CalendarDays, ChartNoAxesCombined, Code2, Hotel, LayoutDashboard, Rows3, ScrollText, Settings, Sparkles, TriangleAlert, Unplug, UserCog, Users } from "lucide-react";
import { PERMISSIONS, type Permission } from "../../access-control/domain/access-control";
import { RESERVATION_CONFLICT_UI } from "../../reservation-conflicts/reservation-conflict.labels";

export const SIDEBAR_MENU_GROUPS = {
  operations: "운영",
  management: "관리",
  statistics: "통계",
  settings: "설정",
  developer: "개발자",
} as const;

export type SidebarMenuGroupId = keyof typeof SIDEBAR_MENU_GROUPS;

export interface SidebarMenuDefinition {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: SidebarMenuGroupId;
  requiredPermission: Permission;
  hideable: boolean;
}

export const SIDEBAR_MENU_ITEMS = [
  { id: "dashboard", label: "대시보드", href: "/", icon: LayoutDashboard, group: "operations", requiredPermission: PERMISSIONS.RESERVATION_READ, hideable: true },
  { id: "room-overview", label: "객실 현황", href: "/room-overview", icon: Hotel, group: "operations", requiredPermission: PERMISSIONS.ROOM_READ, hideable: true },
  { id: "room-status", label: "객실 현황판", href: "/room-status", icon: Rows3, group: "operations", requiredPermission: PERMISSIONS.ROOM_READ, hideable: true },
  { id: "reservations", label: "예약", href: "/reservations", icon: CalendarDays, group: "operations", requiredPermission: PERMISSIONS.RESERVATION_READ, hideable: true },
  { id: "cleaning", label: "청소 관리", href: "/cleaning", icon: Sparkles, group: "operations", requiredPermission: PERMISSIONS.CLEANING_READ, hideable: true },
  { id: "reservation-conflicts", label: RESERVATION_CONFLICT_UI.label, href: "/reservation-conflicts", icon: TriangleAlert, group: "operations", requiredPermission: PERMISSIONS.RESERVATION_READ, hideable: true },
  { id: "properties", label: "숙소", href: "/properties", icon: Building2, group: "management", requiredPermission: PERMISSIONS.PROPERTY_MANAGE, hideable: true },
  { id: "rooms", label: "객실", href: "/rooms", icon: BedDouble, group: "management", requiredPermission: PERMISSIONS.ROOM_MANAGE, hideable: true },
  { id: "calendar-sources", label: "캘린더 연결", href: "/calendar-sources", icon: Unplug, group: "management", requiredPermission: PERMISSIONS.CALENDAR_SOURCE_READ, hideable: true },
  { id: "member-management", label: "구성원 관리", href: "/settings/members", icon: Users, group: "management", requiredPermission: PERMISSIONS.USER_MANAGE, hideable: true },
  { id: "occupancy-statistics", label: "점유율 통계", href: "/statistics/occupancy", icon: ChartNoAxesCombined, group: "statistics", requiredPermission: PERMISSIONS.STATISTICS_READ, hideable: true },
  { id: "admin-settings", label: "관리자 설정", href: "/settings/admin", icon: Settings, group: "settings", requiredPermission: PERMISSIONS.ADMIN_SETTINGS_READ, hideable: false },
  { id: "developer-settings", label: "개발자 설정", href: "/developer/settings", icon: Code2, group: "developer", requiredPermission: PERMISSIONS.DEVELOPER_SETTINGS_READ, hideable: false },
  { id: "developer-users", label: "회원 관리", href: "/developer/users", icon: UserCog, group: "developer", requiredPermission: PERMISSIONS.DEVELOPER_MANAGEMENT_READ, hideable: false },
  { id: "developer-companies", label: "회사 관리", href: "/developer/companies", icon: Building2, group: "developer", requiredPermission: PERMISSIONS.DEVELOPER_MANAGEMENT_READ, hideable: false },
  { id: "developer-audit-logs", label: "작업 로그", href: "/developer/audit-logs", icon: ScrollText, group: "developer", requiredPermission: PERMISSIONS.DEVELOPER_MANAGEMENT_READ, hideable: false },
  { id: "developer-error-logs", label: "오류 로그", href: "/developer/errors", icon: Bug, group: "developer", requiredPermission: PERMISSIONS.DEBUG_READ, hideable: false },
] as const satisfies readonly SidebarMenuDefinition[];

export type SidebarMenuId = (typeof SIDEBAR_MENU_ITEMS)[number]["id"];

export const PUBLIC_DEMO_MENU_IDS = new Set<string>(["dashboard", "room-overview", "room-status", "reservations", "reservation-conflicts", "occupancy-statistics"]);

export const DEFAULT_SIDEBAR_MENU_ORDER: readonly SidebarMenuId[] = SIDEBAR_MENU_ITEMS.map((item) => item.id);

const sidebarMenuIds = new Set<string>(DEFAULT_SIDEBAR_MENU_ORDER);
const protectedMenuIds = new Set<SidebarMenuId>(SIDEBAR_MENU_ITEMS.filter((item) => !item.hideable).map((item) => item.id));

export function isSidebarMenuId(value: unknown): value is SidebarMenuId {
  return typeof value === "string" && sidebarMenuIds.has(value);
}

export function isSidebarMenuHideable(menuId: SidebarMenuId) {
  return !protectedMenuIds.has(menuId);
}

export function findSidebarMenu(menuId: SidebarMenuId) {
  return SIDEBAR_MENU_ITEMS.find((item) => item.id === menuId);
}

export const MOBILE_NAVIGATION_ITEMS = ["room-status", "dashboard", "reservations", "cleaning", "reservation-conflicts", "properties", "rooms", "calendar-sources", "member-management"]
  .map((menuId) => SIDEBAR_MENU_ITEMS.find((item) => item.id === menuId))
  .filter((item): item is (typeof SIDEBAR_MENU_ITEMS)[number] => Boolean(item));
