import type { Prisma } from "@/lib/generated/prisma/client";
import type { ReservationFilters } from "./reservation.types";
import { buildReservationOverlapWhere } from "./reservation-range-overlap";

type ReservationListDateFilters = Pick<
  ReservationFilters,
  "dateField" | "dateMode" | "from" | "toExclusive"
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
  return buildReservationOverlapWhere({
    viewStart: filters.from,
    viewEnd: filters.toExclusive,
  });
}
