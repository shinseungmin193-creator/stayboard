import type { CalendarEventClassificationCounts } from "./classify-calendar-events";

export interface CalendarSyncResult extends CalendarEventClassificationCounts {
  calendarSourceId: string;
  provider: string;
  warning: boolean;
  fetchedCount: number;
  parsedCount: number;
  excludedCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  cancelledCount: number;
  activeConflictCount: number;
  createdConflictCount: number;
  resolvedConflictCount: number;
  completedAt: string;
}
