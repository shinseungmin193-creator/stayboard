import { DEFAULT_TIMEZONE } from "../../lib/constants";
import { getZonedDateInput, getZonedMidnight, isValidDateInput } from "../../lib/zoned-date";

export const RESERVATION_TIME_ZONE = DEFAULT_TIMEZONE;

const MILLISECONDS_PER_DAY = 86_400_000;

function dateInputOrdinal(dateInput: string) {
  return Math.floor(Date.parse(`${dateInput}T00:00:00.000Z`) / MILLISECONDS_PER_DAY);
}

export function getReservationDateInput(value: Date, timeZone = RESERVATION_TIME_ZONE) {
  if (!Number.isFinite(value.getTime())) return null;
  return getZonedDateInput(value, timeZone);
}

export function getReservationDateOrdinal(value: Date, timeZone = RESERVATION_TIME_ZONE) {
  const dateInput = getReservationDateInput(value, timeZone);
  return dateInput ? dateInputOrdinal(dateInput) : null;
}

export function getReservationDateDifference(from: Date, to: Date, timeZone = RESERVATION_TIME_ZONE) {
  const fromOrdinal = getReservationDateOrdinal(from, timeZone);
  const toOrdinal = getReservationDateOrdinal(to, timeZone);
  return fromOrdinal === null || toOrdinal === null ? null : toOrdinal - fromOrdinal;
}

export function getReservationNightCount(
  reservation: { startDate: Date; endDate: Date },
  timeZone = RESERVATION_TIME_ZONE,
) {
  const difference = getReservationDateDifference(reservation.startDate, reservation.endDate, timeZone);
  return difference === null ? 0 : Math.max(0, difference);
}

export function isValidReservationDateRange(
  reservation: { startDate: Date; endDate: Date },
  timeZone = RESERVATION_TIME_ZONE,
) {
  return getReservationNightCount(reservation, timeZone) > 0;
}

function resolveDateInput(value: Date | string, timeZone = RESERVATION_TIME_ZONE) {
  if (typeof value === "string") return isValidDateInput(value) ? value : null;
  return getReservationDateInput(value, timeZone);
}

export function isSameReservationDate(left: Date, right: Date | string, timeZone = RESERVATION_TIME_ZONE) {
  const leftInput = getReservationDateInput(left, timeZone);
  const rightInput = resolveDateInput(right, timeZone);
  return leftInput !== null && rightInput !== null && leftInput === rightInput;
}

export function isReservationCheckInOnDate(
  reservation: { startDate: Date },
  date: Date | string,
  timeZone = RESERVATION_TIME_ZONE,
) {
  return isSameReservationDate(reservation.startDate, date, timeZone);
}

export function isReservationCheckOutOnDate(
  reservation: { endDate: Date },
  date: Date | string,
  timeZone = RESERVATION_TIME_ZONE,
) {
  return isSameReservationDate(reservation.endDate, date, timeZone);
}

export function isReservationOccupiedOnDate(
  reservation: { startDate: Date; endDate: Date },
  date: Date | string,
  timeZone = RESERVATION_TIME_ZONE,
) {
  const start = getReservationDateOrdinal(reservation.startDate, timeZone);
  const end = getReservationDateOrdinal(reservation.endDate, timeZone);
  const dateInput = resolveDateInput(date, timeZone);
  const current = dateInput ? dateInputOrdinal(dateInput) : null;
  return start !== null && end !== null && current !== null && start <= current && current < end;
}

export function doReservationDateRangesOverlap(
  left: { startDate: Date; endDate: Date },
  right: { startDate: Date; endDate: Date },
  timeZone = RESERVATION_TIME_ZONE,
) {
  const leftStart = getReservationDateOrdinal(left.startDate, timeZone);
  const leftEnd = getReservationDateOrdinal(left.endDate, timeZone);
  const rightStart = getReservationDateOrdinal(right.startDate, timeZone);
  const rightEnd = getReservationDateOrdinal(right.endDate, timeZone);
  return leftStart !== null
    && leftEnd !== null
    && rightStart !== null
    && rightEnd !== null
    && leftStart < leftEnd
    && rightStart < rightEnd
    && leftStart < rightEnd
    && rightStart < leftEnd;
}

export function getReservationDateOverlap(
  left: { startDate: Date; endDate: Date },
  right: { startDate: Date; endDate: Date },
  timeZone = RESERVATION_TIME_ZONE,
) {
  if (!doReservationDateRangesOverlap(left, right, timeZone)) return null;
  const leftStart = getReservationDateInput(left.startDate, timeZone)!;
  const leftEnd = getReservationDateInput(left.endDate, timeZone)!;
  const rightStart = getReservationDateInput(right.startDate, timeZone)!;
  const rightEnd = getReservationDateInput(right.endDate, timeZone)!;
  return {
    overlapStart: getZonedMidnight(leftStart >= rightStart ? leftStart : rightStart, timeZone),
    overlapEnd: getZonedMidnight(leftEnd <= rightEnd ? leftEnd : rightEnd, timeZone),
  };
}
