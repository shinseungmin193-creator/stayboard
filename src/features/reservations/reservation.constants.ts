import type { ReservationStatus } from "@/lib/generated/prisma/enums";
import type { ReservationDateField } from "./reservation.types";

export const RESERVATION_PAGE_SIZE = 25;
export const RESERVATION_DEFAULT_PAST_DAYS = 30;
export const RESERVATION_DEFAULT_FUTURE_DAYS = 180;
export const RESERVATION_CONFLICT_DETAILS_PAGE_LIMIT = 100;
export const ACTIVE_OTA_RESERVATION_STATUSES = ["CONFIRMED", "TENTATIVE"] as const satisfies readonly ReservationStatus[];
export const VISIBLE_OTA_RESERVATION_STATUSES = [...ACTIVE_OTA_RESERVATION_STATUSES, "CANCELLED"] as const satisfies readonly ReservationStatus[];

export function isVisibleOtaReservationStatus(status: ReservationStatus) {
  return VISIBLE_OTA_RESERVATION_STATUSES.includes(status as (typeof VISIBLE_OTA_RESERVATION_STATUSES)[number]);
}

export function reservationStatusesForFilter(status: ReservationStatus | undefined, dateField: ReservationDateField | undefined): readonly ReservationStatus[] {
  if (status && isVisibleOtaReservationStatus(status)) return [status];
  return dateField === "checkIn" || dateField === "checkOut" ? ACTIVE_OTA_RESERVATION_STATUSES : VISIBLE_OTA_RESERVATION_STATUSES;
}
