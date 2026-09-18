import type { Prisma } from "../../lib/generated/prisma/client";
import type { CalendarProviderType, ReservationStatus } from "../../lib/generated/prisma/enums";
import { DEFAULT_TIMEZONE } from "../../lib/constants";
import { getZonedDateInput, getZonedMidnight } from "../../lib/zoned-date";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "../reservations/reservation.constants";
import { buildOperationalReservationWhere } from "../reservations/operational-reservation-where";
import { buildReservationOverlapWhere, reservationOverlapsRange } from "../reservations/reservation-range-overlap";
import { isCalendarProviderType } from "../../providers/calendar/types";
import { getReservationDateInput, getReservationDateOrdinal } from "../reservations/reservation-date";

export const ROOM_STATUS_TIME_ZONE = DEFAULT_TIMEZONE;

export interface RoomStatusCalendarRange {
  month: string;
  rangeStart: Date;
  rangeEnd: Date;
}

export interface RoomStatusReservationPlacement {
  startDateInput: string;
  endDateInput: string;
  leftDays: number;
  durationDays: number;
}

function isMonthInput(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, 1));
  return parsed.toISOString().slice(0, 7) === value;
}

export function shiftRoomStatusMonth(month: string, offset: number) {
  const normalized = isMonthInput(month) ? month : "1970-01";
  const [year, monthNumber] = normalized.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return shifted.toISOString().slice(0, 7);
}

export function getRoomStatusCalendarRange(value: string | null | undefined, now = new Date()): RoomStatusCalendarRange {
  const fallbackMonth = getZonedDateInput(now, ROOM_STATUS_TIME_ZONE).slice(0, 7);
  const month = isMonthInput(value) ? value : fallbackMonth;
  const rangeStart = getZonedMidnight(`${month}-01`, ROOM_STATUS_TIME_ZONE);
  const nextMonth = shiftRoomStatusMonth(month, 1);
  const rangeEnd = getZonedMidnight(`${nextMonth}-01`, ROOM_STATUS_TIME_ZONE);
  return { month, rangeStart, rangeEnd };
}

export function buildRoomStatusReservationWhere(range: Pick<RoomStatusCalendarRange, "rangeStart" | "rangeEnd">): Prisma.ReservationWhereInput {
  return {
    ...buildOperationalReservationWhere(),
    ...buildReservationOverlapWhere({
      viewStart: range.rangeStart,
      viewEnd: range.rangeEnd,
    }),
  };
}

export function isReservationVisibleInRoomStatusRange(
  reservation: { startDate: Date; endDate: Date; status: ReservationStatus; provider: CalendarProviderType },
  range: Pick<RoomStatusCalendarRange, "rangeStart" | "rangeEnd">,
) {
  return ACTIVE_OTA_RESERVATION_STATUSES.includes(reservation.status as (typeof ACTIVE_OTA_RESERVATION_STATUSES)[number])
    && isCalendarProviderType(reservation.provider)
    && reservationOverlapsRange(reservation, {
      viewStart: range.rangeStart,
      viewEnd: range.rangeEnd,
    });
}

export function getRoomStatusReservationPlacement(
  reservation: { startDate: Date; endDate: Date },
  rangeStart: string,
  dayCount: number,
): RoomStatusReservationPlacement | null {
  const startDateInput = getReservationDateInput(reservation.startDate, ROOM_STATUS_TIME_ZONE);
  const endDateInput = getReservationDateInput(reservation.endDate, ROOM_STATUS_TIME_ZONE);
  const rangeStartOrdinal = getReservationDateOrdinal(getZonedMidnight(rangeStart, ROOM_STATUS_TIME_ZONE), ROOM_STATUS_TIME_ZONE);
  const startOrdinal = getReservationDateOrdinal(reservation.startDate, ROOM_STATUS_TIME_ZONE);
  const endOrdinal = getReservationDateOrdinal(reservation.endDate, ROOM_STATUS_TIME_ZONE);
  if (!startDateInput || !endDateInput || rangeStartOrdinal === null || startOrdinal === null || endOrdinal === null) return null;
  const leftDays = Math.max(0, startOrdinal - rangeStartOrdinal);
  const endDays = Math.min(dayCount, endOrdinal - rangeStartOrdinal);
  if (endDays <= 0 || leftDays >= dayCount || endDays <= leftDays) return null;
  return { startDateInput, endDateInput, leftDays, durationDays: endDays - leftDays };
}
