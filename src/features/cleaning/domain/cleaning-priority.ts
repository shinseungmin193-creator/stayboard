export type CleaningPriority = "urgent" | "flexible";

export function classifyCleaningPriority(
  checkoutAt: Date,
  checkInDates: readonly Date[],
  operationalDayStart: Date,
  operationalDayEnd: Date,
): CleaningPriority | null {
  if (
    !Number.isFinite(checkoutAt.getTime())
    || checkoutAt <= operationalDayStart
    || checkoutAt > operationalDayEnd
  ) {
    return null;
  }

  return checkInDates.some((checkInAt) => (
    Number.isFinite(checkInAt.getTime())
    && checkInAt >= operationalDayStart
    && checkInAt < operationalDayEnd
  )) ? "urgent" : "flexible";
}
