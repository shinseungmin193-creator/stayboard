import type { CalendarEventClassificationCounts } from "./classify-calendar-events";

export const SYNC_LOG_DETAIL_RETENTION_DAYS = 7;
export const SYNC_LOG_SUCCESS_RETENTION_DAYS = 30;
export const SYNC_LOG_FAILURE_RETENTION_DAYS = 90;

export function shouldRetainSuccessfulSyncDiagnostics(
  counts: CalendarEventClassificationCounts,
  safetyReasonCount: number,
) {
  return safetyReasonCount > 0
    || counts.blockedEventCount > 0
    || counts.cancelledEventCount > 0
    || counts.unknownEventCount > 0
    || counts.failedEventCount > 0;
}
