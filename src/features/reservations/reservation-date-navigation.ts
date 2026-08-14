import { DEFAULT_TIMEZONE } from "../../lib/constants";
import {
  getZonedDateInput,
  getZonedMidnight,
  isValidDateInput,
  shiftDateInput,
} from "../../lib/zoned-date";
import type { ReservationFilterState } from "./reservation-filter-query";
import type { ReservationDateField } from "./reservation.types";

export const RESERVATION_DATE_MODES = ["checkin", "checkout"] as const;
export type ReservationDateMode = (typeof RESERVATION_DATE_MODES)[number];
export type ReservationRelativeDate = "yesterday" | "today" | "tomorrow" | "other";

const DATE_NAVIGATION_STEP_DAYS = 1;

export interface ReservationDateNavigation {
  mode: ReservationDateMode;
  selectedDate: string;
  today: string;
  rangeStart: Date;
  rangeEnd: Date;
}

function isReservationDateMode(value: string | null): value is ReservationDateMode {
  return RESERVATION_DATE_MODES.includes(value as ReservationDateMode);
}

export function getReservationDateField(mode: ReservationDateMode): ReservationDateField {
  return mode === "checkout" ? "checkOut" : "checkIn";
}

export function getPreviousReservationDate(dateInput: string): string {
  return shiftDateInput(dateInput, -DATE_NAVIGATION_STEP_DAYS);
}

export function getNextReservationDate(dateInput: string): string {
  return shiftDateInput(dateInput, DATE_NAVIGATION_STEP_DAYS);
}

export function parseReservationDateNavigation(
  params: Pick<URLSearchParams, "get">,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): ReservationDateNavigation | null {
  const mode = params.get("mode");
  if (!isReservationDateMode(mode)) return null;

  const today = getZonedDateInput(now, timeZone);
  const requestedDate = params.get("date");
  const selectedDate = isValidDateInput(requestedDate) ? requestedDate : today;
  return {
    mode,
    selectedDate,
    today,
    rangeStart: getZonedMidnight(selectedDate, timeZone),
    rangeEnd: getZonedMidnight(getNextReservationDate(selectedDate), timeZone),
  };
}

export function applyReservationDateNavigationToFilters(
  filters: ReservationFilterState,
  navigation: ReservationDateNavigation | null,
): ReservationFilterState {
  if (!navigation) return filters;
  return {
    ...filters,
    dateField: getReservationDateField(navigation.mode),
    from: navigation.selectedDate,
    to: navigation.selectedDate,
  };
}

export function getReservationRelativeDate(selectedDate: string, today: string): ReservationRelativeDate {
  if (selectedDate === today) return "today";
  if (selectedDate === getPreviousReservationDate(today)) return "yesterday";
  if (selectedDate === getNextReservationDate(today)) return "tomorrow";
  return "other";
}

export function reservationDateNavigationHref(
  query: Pick<URLSearchParams, "toString">,
  mode: ReservationDateMode,
  selectedDate: string,
): string {
  const params = new URLSearchParams(query.toString());
  params.set("mode", mode);
  params.set("date", selectedDate);
  params.delete("dateField");
  params.delete("from");
  params.delete("to");
  params.delete("page");
  return `/reservations?${params.toString()}`;
}

export function formatReservationNavigationDate(dateInput: string, locale: "ko" | "ja"): string {
  const date = new Date(`${dateInput}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}.${value("month")}.${value("day")} (${value("weekday")})`;
}
