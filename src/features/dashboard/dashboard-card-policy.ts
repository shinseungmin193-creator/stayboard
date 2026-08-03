import { hasPermission, PERMISSIONS, type UserRole } from "../access-control/domain/access-control";

export type DashboardCardId =
  | "today-check-in"
  | "today-check-out"
  | "overbooking"
  | "priority-cleaning"
  | "flexible-cleaning"
  | "cleaning-management"
  | "sync-failure";

const CORE_CARD_IDS = ["today-check-in", "today-check-out", "overbooking", "priority-cleaning", "flexible-cleaning"] as const satisfies readonly DashboardCardId[];

export function getDashboardCardIds(role: UserRole | null | undefined): DashboardCardId[] {
  if (!role) return [...CORE_CARD_IDS, "sync-failure"];
  return [...CORE_CARD_IDS, "cleaning-management", ...(hasPermission(role, PERMISSIONS.SYNC_READ) ? ["sync-failure" as const] : [])];
}
