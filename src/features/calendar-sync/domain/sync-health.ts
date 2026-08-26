export const CALENDAR_SYNC_WARNING_REASONS = [
  "UNCLASSIFIED_NONEMPTY_FEED",
  "UNKNOWN_EVENTS",
  "FAILED_EVENTS",
  "RESERVATION_COUNT_DROPPED_TO_ZERO",
  "PERSISTENCE_COUNT_MISMATCH",
] as const;

export type CalendarSyncWarningReason = typeof CALENDAR_SYNC_WARNING_REASONS[number];
export type CalendarSyncHealthStatus = "SUCCESS" | "WARNING" | "FAILURE" | "RUNNING" | "NOT_SYNCED";

export interface CalendarSyncHealthInput {
  status: string | null;
  fetchedEventCount: number;
  reservationEventCount: number;
  blockedEventCount: number;
  cancelledEventCount: number;
  unknownEventCount: number;
  failedEventCount: number;
  previousSuccessfulReservationEventCount?: number | null;
  expectedPersistedReservationCount?: number | null;
  persistedReservationCount?: number | null;
}

export interface CalendarSyncHealth {
  status: CalendarSyncHealthStatus;
  warningReasons: CalendarSyncWarningReason[];
}

export function getCalendarSyncHealth(input: CalendarSyncHealthInput): CalendarSyncHealth {
  if (input.status === null) return { status: "NOT_SYNCED", warningReasons: [] };
  if (input.status === "RUNNING") return { status: "RUNNING", warningReasons: [] };
  if (input.status === "FAILED" || input.status === "TIMEOUT") return { status: "FAILURE", warningReasons: [] };
  if (input.status !== "SUCCESS") return { status: "FAILURE", warningReasons: [] };

  const reasons: CalendarSyncWarningReason[] = [];
  const recognizedNonReservationCount = input.blockedEventCount + input.cancelledEventCount;
  if (
    input.fetchedEventCount > 0
    && input.reservationEventCount === 0
    && recognizedNonReservationCount < input.fetchedEventCount
  ) reasons.push("UNCLASSIFIED_NONEMPTY_FEED");
  if (input.unknownEventCount > 0) reasons.push("UNKNOWN_EVENTS");
  if (input.failedEventCount > 0) reasons.push("FAILED_EVENTS");
  if (
    (input.previousSuccessfulReservationEventCount ?? 0) > 0
    && input.reservationEventCount === 0
  ) reasons.push("RESERVATION_COUNT_DROPPED_TO_ZERO");
  if (
    input.expectedPersistedReservationCount !== undefined
    && input.expectedPersistedReservationCount !== null
    && input.persistedReservationCount !== undefined
    && input.persistedReservationCount !== null
    && input.expectedPersistedReservationCount !== input.persistedReservationCount
  ) reasons.push("PERSISTENCE_COUNT_MISMATCH");

  return { status: reasons.length ? "WARNING" : "SUCCESS", warningReasons: reasons };
}

export function isCalendarSyncWarning(input: CalendarSyncHealthInput): boolean {
  return getCalendarSyncHealth(input).status === "WARNING";
}
