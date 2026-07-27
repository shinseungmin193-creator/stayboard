import type { ReservationFilterState } from "./reservation-filter-query";
import { getReservationDatePresetRange } from "./reservation-date-presets";

export type ReservationQuickFilter =
  | "today-check-in"
  | "today-check-out"
  | "week-check-in"
  | "week-check-out"
  | "month-stays"
  | "conflicts";

export function applyQuickReservationFilter(filters: ReservationFilterState, quickFilter: ReservationQuickFilter, now = new Date()): ReservationFilterState {
  if (quickFilter === "conflicts") return { ...filters, hasConflict: true };
  const preset = quickFilter === "month-stays" ? "this-month" : quickFilter.startsWith("week") ? "this-week" : "today";
  const range = getReservationDatePresetRange(preset, now);
  return {
    ...filters,
    statuses: [],
    hasConflict: null,
    dateField: quickFilter === "today-check-out" || quickFilter === "week-check-out" ? "checkOut" : quickFilter === "month-stays" ? "stay" : "checkIn",
    from: range.from,
    to: range.to,
  };
}
