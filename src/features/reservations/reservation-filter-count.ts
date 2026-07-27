import type { ReservationFilterState } from "./reservation-filter-query";

export function getReservationFilterCount(filters: ReservationFilterState): number {
  return Number(Boolean(filters.propertyId))
    + Number(Boolean(filters.roomId))
    + filters.providers.length
    + filters.statuses.length
    + Number(Boolean(filters.from || filters.to))
    + Number(filters.hasConflict !== null);
}
