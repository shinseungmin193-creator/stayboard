import type { LucideIcon } from "lucide-react";
import { BedDouble, Bug, Building2, CalendarDays, ChartNoAxesCombined, Code2, Hotel, LayoutDashboard, MessageSquareText, Rows3, ScrollText, Settings, Sparkles, Star, TriangleAlert, Unplug, UserCog, Users } from "lucide-react";
import { PERMISSIONS, type Permission } from "../../access-control/domain/access-control";
import { RESERVATION_CONFLICT_UI } from "../../reservation-conflicts/reservation-conflict.labels";

export interface SidebarMenuDefinition {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  requiredPermission: Permission;
  relatedPermissions: readonly Permission[];
  hideable: boolean;
}

export const SIDEBAR_MENU_ITEMS = [
  { id: "room-overview", label: "객실 현황", href: "/room-overview", icon: Hotel, requiredPermission: PERMISSIONS.ROOM_READ, relatedPermissions: [PERMISSIONS.ROOM_READ, PERMISSIONS.ROOM_OPERATIONAL_STATUS_UPDATE, PERMISSIONS.SYNC_RUN], hideable: true },
  { id: "room-status", label: "객실 현황판", href: "/room-status", icon: Rows3, requiredPermission: PERMISSIONS.ROOM_READ, relatedPermissions: [PERMISSIONS.ROOM_READ, PERMISSIONS.SYNC_RUN], hideable: true },
  { id: "dashboard", label: "대시보드", href: "/", icon: LayoutDashboard, requiredPermission: PERMISSIONS.RESERVATION_READ, relatedPermissions: [PERMISSIONS.RESERVATION_READ, PERMISSIONS.SYNC_READ], hideable: true },
  { id: "reservations", label: "예약", href: "/reservations", icon: CalendarDays, requiredPermission: PERMISSIONS.RESERVATION_READ, relatedPermissions: [PERMISSIONS.RESERVATION_READ], hideable: true },
  { id: "reservation-conflicts", label: RESERVATION_CONFLICT_UI.label, href: "/reservation-conflicts", icon: TriangleAlert, requiredPermission: PERMISSIONS.RESERVATION_READ, relatedPermissions: [PERMISSIONS.RESERVATION_READ], hideable: true },
  { id: "properties", label: "숙소", href: "/properties", icon: Building2, requiredPermission: PERMISSIONS.PROPERTY_MANAGE, relatedPermissions: [PERMISSIONS.PROPERTY_MANAGE], hideable: true },
  { id: "rooms", label: "객실", href: "/rooms", icon: BedDouble, requiredPermission: PERMISSIONS.ROOM_MANAGE, relatedPermissions: [PERMISSIONS.ROOM_MANAGE, PERMISSIONS.CALENDAR_SOURCE_READ, PERMISSIONS.CALENDAR_SOURCE_MANAGE], hideable: true },
  { id: "calendar-sources", label: "캘린더 연결", href: "/calendar-sources", icon: Unplug, requiredPermission: PERMISSIONS.CALENDAR_SOURCE_READ, relatedPermissions: [PERMISSIONS.CALENDAR_SOURCE_READ, PERMISSIONS.CALENDAR_SOURCE_MANAGE, PERMISSIONS.SYNC_READ, PERMISSIONS.SYNC_RUN], hideable: true },
  { id: "occupancy-statistics", label: "점유율 통계", href: "/statistics/occupancy", icon: ChartNoAxesCombined, requiredPermission: PERMISSIONS.STATISTICS_READ, relatedPermissions: [PERMISSIONS.STATISTICS_READ], hideable: true },
  { id: "cleaning", label: "청소 관리", href: "/cleaning", icon: Sparkles, requiredPermission: PERMISSIONS.CLEANING_READ, relatedPermissions: [PERMISSIONS.CLEANING_READ, PERMISSIONS.CLEANING_MANAGE, PERMISSIONS.CLEANING_COMPLETION_MANAGE, PERMISSIONS.CLEANING_ASSIGN, PERMISSIONS.CLEANING_WORKER_READ, PERMISSIONS.CLEANING_WORKER_CREATE, PERMISSIONS.CLEANING_WORKER_MANAGE, PERMISSIONS.ROOM_NOTE_COMPLETE, PERMISSIONS.STATISTICS_READ], hideable: true },
  { id: "room-notes", label: "객실 메모", href: "/room-notes", icon: MessageSquareText, requiredPermission: PERMISSIONS.ROOM_NOTE_READ, relatedPermissions: [PERMISSIONS.ROOM_NOTE_READ, PERMISSIONS.ROOM_NOTE_CREATE, PERMISSIONS.ROOM_NOTE_COMPLETE, PERMISSIONS.ROOM_NOTE_DELETE], hideable: true },
  { id: "property-reviews", label: "숙소별 리뷰", href: "/property-reviews", icon: Star, requiredPermission: PERMISSIONS.PROPERTY_REVIEW_READ, relatedPermissions: [PERMISSIONS.PROPERTY_REVIEW_READ, PERMISSIONS.PROPERTY_REVIEW_SYNC], hideable: true },
  { id: "member-management", label: "구성원 관리", href: "/settings/members", icon: Users, requiredPermission: PERMISSIONS.USER_MANAGE, relatedPermissions: [PERMISSIONS.USER_MANAGE], hideable: true },
  { id: "admin-settings", label: "관리자 설정", href: "/settings/admin", icon: Settings, requiredPermission: PERMISSIONS.ADMIN_SETTINGS_READ, relatedPermissions: [PERMISSIONS.ADMIN_SETTINGS_READ, PERMISSIONS.ADMIN_SETTINGS_MANAGE], hideable: false },
  { id: "developer-settings", label: "개발자 설정", href: "/developer/settings", icon: Code2, requiredPermission: PERMISSIONS.DEVELOPER_SETTINGS_READ, relatedPermissions: [PERMISSIONS.DEVELOPER_SETTINGS_READ, PERMISSIONS.DEVELOPER_SETTINGS_MANAGE, PERMISSIONS.FEATURE_FLAGS_MANAGE], hideable: false },
  { id: "developer-users", label: "회원 관리", href: "/developer/users", icon: UserCog, requiredPermission: PERMISSIONS.DEVELOPER_MANAGEMENT_READ, relatedPermissions: [PERMISSIONS.DEVELOPER_MANAGEMENT_READ, PERMISSIONS.DEVELOPER_MANAGEMENT_MANAGE], hideable: false },
  { id: "developer-companies", label: "회사 관리", href: "/developer/companies", icon: Building2, requiredPermission: PERMISSIONS.DEVELOPER_MANAGEMENT_READ, relatedPermissions: [PERMISSIONS.DEVELOPER_MANAGEMENT_READ, PERMISSIONS.DEVELOPER_MANAGEMENT_MANAGE], hideable: false },
  { id: "developer-audit-logs", label: "작업 로그", href: "/developer/audit-logs", icon: ScrollText, requiredPermission: PERMISSIONS.DEVELOPER_MANAGEMENT_READ, relatedPermissions: [PERMISSIONS.DEVELOPER_MANAGEMENT_READ], hideable: false },
  { id: "developer-error-logs", label: "오류 로그", href: "/developer/errors", icon: Bug, requiredPermission: PERMISSIONS.DEBUG_READ, relatedPermissions: [PERMISSIONS.DEBUG_READ], hideable: false },
] as const satisfies readonly SidebarMenuDefinition[];

export type SidebarMenuId = (typeof SIDEBAR_MENU_ITEMS)[number]["id"];

export const PUBLIC_DEMO_MENU_IDS = new Set<string>(["dashboard", "room-overview", "room-status", "reservations", "reservation-conflicts", "occupancy-statistics"]);

export const DEFAULT_SIDEBAR_MENU_ORDER: readonly SidebarMenuId[] = SIDEBAR_MENU_ITEMS.map((item) => item.id);

const sidebarMenuIds = new Set<string>(DEFAULT_SIDEBAR_MENU_ORDER);
const protectedMenuIds = new Set<SidebarMenuId>(SIDEBAR_MENU_ITEMS.filter((item) => !item.hideable).map((item) => item.id));
const developerRequiredMenuIds = new Set<SidebarMenuId>(["developer-settings", "developer-users", "developer-companies", "developer-audit-logs", "developer-error-logs"]);

export function isSidebarMenuId(value: unknown): value is SidebarMenuId {
  return typeof value === "string" && sidebarMenuIds.has(value);
}

export function isSidebarMenuHideable(menuId: SidebarMenuId) {
  return !protectedMenuIds.has(menuId);
}

export function isDeveloperRequiredSidebarMenu(menuId: SidebarMenuId) {
  return developerRequiredMenuIds.has(menuId);
}

export function findSidebarMenu(menuId: SidebarMenuId) {
  return SIDEBAR_MENU_ITEMS.find((item) => item.id === menuId);
}

export const MOBILE_NAVIGATION_ITEMS = ["room-status", "dashboard", "reservations", "cleaning", "reservation-conflicts", "properties", "rooms", "room-notes", "calendar-sources", "member-management"]
  .map((menuId) => SIDEBAR_MENU_ITEMS.find((item) => item.id === menuId))
  .filter((item): item is (typeof SIDEBAR_MENU_ITEMS)[number] => Boolean(item));
