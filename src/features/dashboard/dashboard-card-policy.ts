import { hasPermission, PERMISSIONS, type Permission, type UserRole } from "../access-control/domain/access-control";
import type { StatIconName } from "./dashboard-stat-card";

export type DashboardCardId =
  | "today-check-in"
  | "today-check-out"
  | "overbooking"
  | "priority-cleaning"
  | "flexible-cleaning"
  | "cleaning-management"
  | "sync-failure";

export interface DashboardCardDefinition {
  id: DashboardCardId;
  labelKey: string;
  iconName: StatIconName;
  requiredPermission: Permission;
  guestVisible: boolean;
  staffMobileConfigurable: boolean;
  staffMobileDefaultVisible: boolean;
}

export const DASHBOARD_CARD_REGISTRY = [
  { id: "today-check-in", labelKey: "reservation.statuses.CHECK_IN_TODAY", iconName: "checkin", requiredPermission: PERMISSIONS.RESERVATION_READ, guestVisible: true, staffMobileConfigurable: true, staffMobileDefaultVisible: true },
  { id: "today-check-out", labelKey: "reservation.statuses.CHECK_OUT_TODAY", iconName: "checkout", requiredPermission: PERMISSIONS.RESERVATION_READ, guestVisible: true, staffMobileConfigurable: true, staffMobileDefaultVisible: true },
  { id: "overbooking", labelKey: "conflict.label", iconName: "overbooking", requiredPermission: PERMISSIONS.RESERVATION_READ, guestVisible: true, staffMobileConfigurable: true, staffMobileDefaultVisible: true },
  { id: "priority-cleaning", labelKey: "auto.m0064", iconName: "priority-cleaning", requiredPermission: PERMISSIONS.CLEANING_READ, guestVisible: true, staffMobileConfigurable: true, staffMobileDefaultVisible: true },
  { id: "flexible-cleaning", labelKey: "auto.m0066", iconName: "flexible-cleaning", requiredPermission: PERMISSIONS.CLEANING_READ, guestVisible: true, staffMobileConfigurable: true, staffMobileDefaultVisible: true },
  { id: "cleaning-management", labelKey: "cleaning.title", iconName: "cleaning-management", requiredPermission: PERMISSIONS.CLEANING_READ, guestVisible: false, staffMobileConfigurable: true, staffMobileDefaultVisible: true },
  { id: "sync-failure", labelKey: "auto.m0063", iconName: "sync-failure", requiredPermission: PERMISSIONS.SYNC_READ, guestVisible: true, staffMobileConfigurable: false, staffMobileDefaultVisible: false },
] as const satisfies readonly DashboardCardDefinition[];

export const DASHBOARD_CARD_BY_ID = Object.fromEntries(
  DASHBOARD_CARD_REGISTRY.map((card) => [card.id, card]),
) as Record<DashboardCardId, (typeof DASHBOARD_CARD_REGISTRY)[number]>;

export const STAFF_MOBILE_DASHBOARD_CARD_IDS = DASHBOARD_CARD_REGISTRY
  .filter((card) => card.staffMobileConfigurable)
  .map((card) => card.id) as DashboardCardId[];

export function getDashboardCardIds(role: UserRole | null | undefined): DashboardCardId[] {
  return DASHBOARD_CARD_REGISTRY
    .filter((card) => role ? hasPermission(role, card.requiredPermission) : card.guestVisible)
    .map((card) => card.id);
}
