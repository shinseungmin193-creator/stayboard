import { DEFAULT_TIMEZONE } from "../../../lib/constants";
import { getZonedDateInput, getZonedMidnight } from "../../../lib/zoned-date";

export const RESERVATION_CONFLICT_VIEW_STATUSES = ["ACTIVE", "PAST", "DISMISSED", "ALL"] as const;
export type ReservationConflictViewStatus = (typeof RESERVATION_CONFLICT_VIEW_STATUSES)[number];

export function getReservationConflictTodayStart(
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
) {
  return getZonedMidnight(getZonedDateInput(now, timeZone), timeZone);
}

export function isPastReservationConflict(overlapEnd: Date, todayStart: Date) {
  return Number.isFinite(overlapEnd.getTime())
    && Number.isFinite(todayStart.getTime())
    && overlapEnd < todayStart;
}
