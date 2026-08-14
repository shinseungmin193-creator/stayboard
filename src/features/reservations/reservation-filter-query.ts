import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { CALENDAR_PROVIDER_TYPES } from "../../providers/calendar/types";
import { ACTIVE_RESERVATION_DISPLAY_STATUSES, type ActiveReservationDisplayStatus } from "./reservation-display-status";
import type { ReservationDateField } from "./reservation.types";
import { isValidDateInput } from "../../lib/zoned-date";

export interface ReservationFilterState {
  search: string;
  propertyId: string | null;
  roomId: string | null;
  providers: CalendarProviderType[];
  statuses: ActiveReservationDisplayStatus[];
  dateField: ReservationDateField;
  from: string | null;
  to: string | null;
  hasConflict: boolean | null;
}

export const EMPTY_RESERVATION_FILTERS: ReservationFilterState = {
  search: "",
  propertyId: null,
  roomId: null,
  providers: [],
  statuses: [],
  dateField: "stay",
  from: null,
  to: null,
  hasConflict: null,
};

export const RESERVATION_FILTER_QUERY_KEYS = [
  "search",
  "propertyId",
  "roomId",
  "provider",
  "status",
  "dateField",
  "from",
  "to",
  "conflict",
  "page",
] as const;

const DATE_FIELDS = new Set<ReservationDateField>(["stay", "checkIn", "checkOut"]);

function validDateInput(value: string | null): string | null {
  return isValidDateInput(value) ? value : null;
}

function validList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) return [];
  const allowedValues = new Set<string>(allowed);
  return [...new Set(value.split(",").filter((item): item is T => allowedValues.has(item)))];
}

export function parseReservationFilters(
  params: Pick<URLSearchParams, "get">,
  allowedProviders: readonly CalendarProviderType[] = CALENDAR_PROVIDER_TYPES,
  allowedStatuses: readonly ActiveReservationDisplayStatus[] = ACTIVE_RESERVATION_DISPLAY_STATUSES,
): ReservationFilterState {
  const dateFieldValue = params.get("dateField");
  const dateField = DATE_FIELDS.has(dateFieldValue as ReservationDateField)
    ? dateFieldValue as ReservationDateField
    : "stay";
  const conflict = params.get("conflict");
  const from = validDateInput(params.get("from"));
  const requestedTo = validDateInput(params.get("to"));
  const to = from && requestedTo && requestedTo < from ? from : requestedTo;
  return {
    search: params.get("search")?.trim().slice(0, 120) ?? "",
    propertyId: params.get("propertyId") || null,
    roomId: params.get("roomId") || null,
    providers: validList(params.get("provider"), allowedProviders),
    statuses: validList(params.get("status"), allowedStatuses),
    dateField,
    from,
    to,
    hasConflict: conflict === "true" ? true : conflict === "false" ? false : null,
  };
}

export function serializeReservationFilters(filters: ReservationFilterState, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of RESERVATION_FILTER_QUERY_KEYS) params.delete(key);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.propertyId) params.set("propertyId", filters.propertyId);
  if (filters.roomId) params.set("roomId", filters.roomId);
  if (filters.providers.length) params.set("provider", filters.providers.join(","));
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.dateField !== "stay") params.set("dateField", filters.dateField);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.hasConflict !== null) params.set("conflict", String(filters.hasConflict));
  return params;
}

export function reservationFiltersEqual(left: ReservationFilterState, right: ReservationFilterState): boolean {
  return serializeReservationFilters(left).toString() === serializeReservationFilters(right).toString();
}
