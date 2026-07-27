import type { ReservationStatus } from "@/lib/generated/prisma/enums";
import { getDashboardDateInput } from "../dashboard/dashboard-time";

export const RESERVATION_DISPLAY_STATUSES = [
  "UPCOMING",
  "STAYING",
  "CHECK_IN_TODAY",
  "CHECK_OUT_TODAY",
  "PAST",
  "CANCELLED",
] as const;

export type ReservationDisplayStatus = (typeof RESERVATION_DISPLAY_STATUSES)[number];

export const ACTIVE_RESERVATION_DISPLAY_STATUSES = [
  "UPCOMING",
  "STAYING",
  "CHECK_IN_TODAY",
  "CHECK_OUT_TODAY",
] as const satisfies readonly ReservationDisplayStatus[];

export type ActiveReservationDisplayStatus = (typeof ACTIVE_RESERVATION_DISPLAY_STATUSES)[number];

export function isActiveReservationDisplayStatus(status: ReservationDisplayStatus): status is ActiveReservationDisplayStatus {
  return ACTIVE_RESERVATION_DISPLAY_STATUSES.includes(status as ActiveReservationDisplayStatus);
}

export function getReservationDisplayStatus(input: {
  reservationStatus: ReservationStatus;
  startDate: Date;
  endDate: Date;
  businessDate: Date;
}): ReservationDisplayStatus {
  if (input.reservationStatus === "CANCELLED") return "CANCELLED";

  const businessDate = getDashboardDateInput(input.businessDate);
  const startDate = getDashboardDateInput(input.startDate);
  const endDate = getDashboardDateInput(input.endDate);

  if (endDate < businessDate) return "PAST";
  if (startDate === businessDate) return "CHECK_IN_TODAY";
  if (endDate === businessDate) return "CHECK_OUT_TODAY";
  if (startDate < businessDate && endDate > businessDate) return "STAYING";
  return "UPCOMING";
}
