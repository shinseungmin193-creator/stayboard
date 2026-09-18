import { isSameReservationDate } from "../../reservations/reservation-date";

export type CleaningPriority = "urgent" | "flexible";

export function classifyCleaningPriority(
  checkoutAt: Date,
  checkInDates: readonly Date[],
  operationalDayStart: Date,
  operationalDayEnd: Date,
): CleaningPriority | null {
  void operationalDayEnd;
  if (
    !Number.isFinite(checkoutAt.getTime())
    || !isSameReservationDate(checkoutAt, operationalDayStart)
  ) {
    return null;
  }

  return checkInDates.some((checkInAt) => (
    Number.isFinite(checkInAt.getTime())
    && isSameReservationDate(checkInAt, operationalDayStart)
  )) ? "urgent" : "flexible";
}
