import "server-only";

import { addDays } from "date-fns";
import type { AccessScope } from "@/features/access-control";
import { getDashboardDateInput, getDashboardTodayRange } from "@/features/dashboard/dashboard-time";
import { RESERVATION_DEFAULT_FUTURE_DAYS } from "./reservation.constants";
import type { ReservationFilterState } from "./reservation-filter-query";
import type { ReservationFilters } from "./reservation.types";

export function getReservationEffectiveDateRange(filters: ReservationFilterState, now = new Date()) {
  const { start } = getDashboardTodayRange(now);
  const fallbackFrom = start;
  const fallbackTo = addDays(start, RESERVATION_DEFAULT_FUTURE_DAYS);
  const parsedFrom = filters.from ? new Date(`${filters.from}T00:00:00+09:00`) : fallbackFrom;
  const parsedTo = filters.to ? new Date(`${filters.to}T00:00:00+09:00`) : fallbackTo;
  const from = Number.isFinite(parsedFrom.getTime()) ? parsedFrom : fallbackFrom;
  const validTo = Number.isFinite(parsedTo.getTime()) ? parsedTo : fallbackTo;
  const to = validTo < from ? from : validTo;
  return {
    from,
    to,
    fromInput: getDashboardDateInput(from),
    toInput: getDashboardDateInput(to),
  };
}

export function getReservationPage(params: Pick<URLSearchParams, "get">): number {
  const page = Number(params.get("page"));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function buildReservationRepositoryFilters(input: {
  filters: ReservationFilterState;
  page: number;
  now?: Date;
  companyIds?: readonly string[];
  accessScope?: AccessScope;
}): { repositoryFilters: ReservationFilters; effectiveDateRange: ReturnType<typeof getReservationEffectiveDateRange> } {
  const businessDate = input.now ?? new Date();
  const effectiveDateRange = getReservationEffectiveDateRange(input.filters, businessDate);
  return {
    effectiveDateRange,
    repositoryFilters: {
      search: input.filters.search || undefined,
      propertyId: input.filters.propertyId ?? undefined,
      roomId: input.filters.roomId ?? undefined,
      providers: input.filters.providers.length ? input.filters.providers : undefined,
      displayStatuses: input.filters.statuses.length ? input.filters.statuses : undefined,
      businessDate,
      dateField: input.filters.dateField,
      from: effectiveDateRange.from,
      toExclusive: addDays(effectiveDateRange.to, 1),
      hasConflict: input.filters.hasConflict ?? undefined,
      page: input.page,
      companyIds: input.companyIds,
      accessScope: input.accessScope,
    },
  };
}
