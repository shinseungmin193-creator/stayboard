export interface CalendarSyncHealthInput {
  status: string | null;
  fetchedEventCount: number;
  reservationEventCount: number;
  blockedEventCount: number;
  cancelledEventCount: number;
  unknownEventCount: number;
  failedEventCount: number;
}

export function isCalendarSyncWarning(input: CalendarSyncHealthInput): boolean {
  if (input.status !== "SUCCESS" || input.fetchedEventCount <= 0) return false;
  const recognizedCount = input.reservationEventCount + input.blockedEventCount + input.cancelledEventCount;
  return recognizedCount === 0 && input.unknownEventCount + input.failedEventCount > 0;
}
