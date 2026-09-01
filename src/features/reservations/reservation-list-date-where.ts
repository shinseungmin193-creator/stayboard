import type { Prisma } from "@/lib/generated/prisma/client";
import type { ReservationFilters } from "./reservation.types";

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
    return { endDate: { gt: filters.from, lte: filters.toExclusive } };
  }
  if (filters.dateField === "checkIn") {
    return { startDate: { gte: filters.from, lt: filters.toExclusive } };
  }
  if (filters.dateField === "checkOut") {
    return { endDate: { gt: filters.from, lte: filters.toExclusive } };
  }
  return {
    startDate: { lt: filters.toExclusive },
    endDate: { gt: filters.from },
  };
}
