import type { CalendarEventClassificationCounts } from "./classify-calendar-events";
import type { CalendarSyncHealthStatus, CalendarSyncWarningReason } from "./sync-health";

export interface CalendarSyncResult extends CalendarEventClassificationCounts {
  calendarSourceId: string;
  provider: string;
  warning: boolean;
  healthStatus: CalendarSyncHealthStatus;
  warningReasons: CalendarSyncWarningReason[];
  fetchedCount: number;
  parsedCount: number;
  excludedCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  cancelledCount: number;
  expectedSourceOperationalReservationCount: number;
  currentSourceOperationalReservationCount: number;
  activeConflictCount: number;
  createdConflictCount: number;
  resolvedConflictCount: number;
  completedAt: string;
}
