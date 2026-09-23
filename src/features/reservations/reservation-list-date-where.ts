import type { Prisma } from "@/lib/generated/prisma/client";
import type { ReservationFilters } from "./reservation.types";
import { buildReservationOverlapWhere } from "./reservation-range-overlap";

type ReservationListDateFilters = Pick<
  ReservationFilters,
  "dateField" | "dateMode" | "from" | "toExclusive" | "defaultHistoryWindow"
>;

export function buildReservationListDateWhere(
  filters: ReservationListDateFilters,
): Prisma.ReservationWhereInput {
  if (filters.dateMode === "checkin") {
    return { startDate: { gte: filters.from, lt: filters.toExclusive } };
  }
  if (filters.dateMode === "checkout") {
    return { endDate: { gte: filters.from, lt: filters.toExclusive } };
  }
  if (filters.dateField === "checkIn") {
    return { startDate: { gte: filters.from, lt: filters.toExclusive } };
  }
  if (filters.dateField === "checkOut") {
    return { endDate: { gte: filters.from, lt: filters.toExclusive } };
  }
  if (filters.defaultHistoryWindow) {
    // The default reservation-list policy is based on checkout date. A
    // checkout exactly on the three-month boundary remains in the window,
    // while the future ceiling still keeps the operational query bounded.
    return {
      startDate: { lt: filters.toExclusive },
      endDate: { gte: filters.from },
    };
  }
  return buildReservationOverlapWhere({
    viewStart: filters.from,
    viewEnd: filters.toExclusive,
  });
}
