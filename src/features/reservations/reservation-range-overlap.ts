import type { Prisma } from "@/lib/generated/prisma/client";

export interface ReservationViewRange {
  viewStart: Date;
  viewEnd: Date;
}

/**
 * Reservation nights use a half-open interval: [startDate, endDate).
 * A calendar query must therefore be based only on the viewed range, never on
 * the current clock time.
 */
export function buildReservationOverlapWhere(
  range: ReservationViewRange,
): Pick<Prisma.ReservationWhereInput, "startDate" | "endDate"> {
  return {
    startDate: { lt: range.viewEnd },
    endDate: { gt: range.viewStart },
  };
}

export function reservationOverlapsRange(
  reservation: { startDate: Date; endDate: Date },
  range: ReservationViewRange,
) {
  return reservation.startDate < range.viewEnd
    && reservation.endDate > range.viewStart;
}
