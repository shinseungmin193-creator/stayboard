import "server-only";

import type { AccessScope } from "@/features/access-control";
import { getDashboardTodayRange } from "@/features/dashboard/dashboard-time";
import { getZonedDateInput, getZonedMidnight, isValidDateInput, shiftDateInput } from "@/lib/zoned-date";
import { RESERVATION_DEFAULT_FUTURE_DAYS } from "./reservation.constants";
import type { ReservationFilterState } from "./reservation-filter-query";
import type { ReservationFilters } from "./reservation.types";
import type { ReservationDateNavigation } from "./reservation-date-navigation";

export function getReservationEffectiveDateRange(filters: ReservationFilterState, now = new Date()) {
  const { start } = getDashboardTodayRange(now);
  const fallbackFrom = start;
  const fallbackFromInput = getZonedDateInput(start);
  const fallbackToInput = shiftDateInput(fallbackFromInput, RESERVATION_DEFAULT_FUTURE_DAYS);
  const fromInput = isValidDateInput(filters.from) ? filters.from : fallbackFromInput;
  const requestedToInput = isValidDateInput(filters.to) ? filters.to : fallbackToInput;
  const from = fromInput === fallbackFromInput ? fallbackFrom : getZonedMidnight(fromInput);
  const validTo = getZonedMidnight(requestedToInput);
  const to = validTo < from ? from : validTo;
  return {
    from,
    to,
    fromInput,
    toInput: validTo < from ? fromInput : requestedToInput,
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
  dateNavigation?: ReservationDateNavigation | null;
  companyIds?: readonly string[];
  accessScope?: AccessScope;
}): { repositoryFilters: ReservationFilters; effectiveDateRange: ReturnType<typeof getReservationEffectiveDateRange> } {
  const businessDate = input.now ?? new Date();
  const effectiveDateRange = input.dateNavigation
    ? {
        from: input.dateNavigation.rangeStart,
        to: input.dateNavigation.rangeStart,
        fromInput: input.dateNavigation.selectedDate,
        toInput: input.dateNavigation.selectedDate,
      }
    : getReservationEffectiveDateRange(input.filters, businessDate);
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
      dateMode: input.dateNavigation?.mode,
      from: effectiveDateRange.from,
      toExclusive: input.dateNavigation?.rangeEnd
        ?? getZonedMidnight(shiftDateInput(effectiveDateRange.toInput, 1)),
      hasConflict: input.filters.hasConflict ?? undefined,
      page: input.page,
      companyIds: input.companyIds,
      accessScope: input.accessScope,
    },
  };
}
