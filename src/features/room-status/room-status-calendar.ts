import type { Prisma } from "../../lib/generated/prisma/client";
import type { CalendarProviderType, ReservationStatus } from "../../lib/generated/prisma/enums";
import { DEFAULT_TIMEZONE } from "../../lib/constants";
import { getZonedDateInput, getZonedMidnight } from "../../lib/zoned-date";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "../reservations/reservation.constants";

export const ROOM_STATUS_TIME_ZONE = DEFAULT_TIMEZONE;

export interface RoomStatusCalendarRange {
  month: string;
  rangeStart: Date;
  rangeEnd: Date;
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
    status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] },
    startDate: { lt: range.rangeEnd },
    endDate: { gt: range.rangeStart },
  };
}

export function isReservationVisibleInRoomStatusRange(
  reservation: { startDate: Date; endDate: Date; status: ReservationStatus; provider: CalendarProviderType },
  range: Pick<RoomStatusCalendarRange, "rangeStart" | "rangeEnd">,
) {
  return ACTIVE_OTA_RESERVATION_STATUSES.includes(reservation.status as (typeof ACTIVE_OTA_RESERVATION_STATUSES)[number])
    && reservation.startDate < range.rangeEnd
    && reservation.endDate > range.rangeStart;
}
