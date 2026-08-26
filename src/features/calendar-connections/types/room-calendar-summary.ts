import type { CalendarConnectionStatus, CalendarProviderType, SyncExecutionMode, SyncStatus } from "@/lib/generated/prisma/enums";
import type { AccessScope } from "@/features/access-control/domain/access-control";
import type { CalendarFeedQuarantineReason } from "@/features/calendar-sync/domain/calendar-feed-safety";
import type { CalendarSyncHealthStatus, CalendarSyncWarningReason } from "@/features/calendar-sync/domain/sync-health";

export type RoomCalendarStatus = "HEALTHY" | "WARNING" | "PARTIAL_FAILURE" | "FAILED" | "SYNCING" | "RECONNECT_REQUIRED" | "NOT_SYNCED" | "DISABLED";
export const ROOM_CALENDAR_STATUS_META = {
  HEALTHY: { className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: "check" },
  WARNING: { className: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300", icon: "warning" },
  PARTIAL_FAILURE: { className: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300", icon: "warning" },
  FAILED: { className: "border-destructive/40 bg-destructive/10 text-destructive", icon: "error" },
  SYNCING: { className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: "loading" },
  RECONNECT_REQUIRED: { className: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300", icon: "warning" },
  NOT_SYNCED: { className: "border-border bg-muted/50 text-muted-foreground", icon: "clock" },
  DISABLED: { className: "border-border bg-muted/50 text-muted-foreground", icon: "off" },
} satisfies Record<RoomCalendarStatus, { className: string; icon: "check" | "warning" | "error" | "loading" | "clock" | "off" }>;

export function getRoomCalendarStatusLabel(
  status: RoomCalendarStatus,
  translate: (key: `calendarStatus.${RoomCalendarStatus}`) => string,
) {
  return translate(`calendarStatus.${status}`);
}

export const CALENDAR_PROVIDER_LABELS = { AIRBNB: "Airbnb", BOOKING: "Booking.com", AGODA: "Agoda", EXPEDIA: "Expedia", VRBO: "Vrbo", OTHER: "기타" } satisfies Record<CalendarProviderType, string>;

export interface CalendarSourceSummary {
  id: string; roomId: string; roomName: string; propertyId: string; propertyName: string; provider: CalendarProviderType; name: string; maskedUrl: string; isActive: boolean; connectionStatus: CalendarConnectionStatus; safetyReasonCodes: CalendarFeedQuarantineReason[]; lastSyncedAt: Date | null;
  latestSyncStatus: SyncStatus | null; latestSyncStartedAt: Date | null; latestSyncCompletedAt: Date | null; latestFetchedCount: number; latestCreatedCount: number; latestUpdatedCount: number; latestCancelledCount: number;
  latestReservationEventCount: number; latestBlockedCount: number; latestUnknownCount: number; latestFailedEventCount: number; latestRetryCount: number; latestHttpStatus: number | null; latestErrorCode: string | null; latestErrorMessage: string | null; latestErrorDetails: string | null; latestDurationMs: number | null; isSyncing: boolean; isWarning: boolean;
  currentReservationCount: number; currentVisibleReservationCount: number; healthStatus: CalendarSyncHealthStatus; warningReasons: CalendarSyncWarningReason[];
}

export interface SyncRunHistoryItem { id: string; startedAt: Date; finishedAt: Date | null; executionMode: SyncExecutionMode; targetCount: number; successCount: number; failedCount: number; status: RoomCalendarStatus; actorName: string; errorSummary: string | null }

export interface RoomCalendarSummary {
  roomId: string; roomName: string; propertyId: string; propertyName: string; sources: CalendarSourceSummary[]; providerCount: number; activeSourceCount: number; reservationCount: number; conflictCount: number; lastSyncedAt: Date | null; status: RoomCalendarStatus;
  latestRun: { id: string; targetCount: number; successCount: number; failedCount: number; startedAt: Date; finishedAt: Date | null } | null; history: SyncRunHistoryItem[]; failureSummaries: Array<{ provider: CalendarProviderType; message: string }>;
}

export interface RoomCalendarFilters { propertyId?: string; roomId?: string; provider?: CalendarProviderType; status?: RoomCalendarStatus; companyIds?: readonly string[]; accessScope?: AccessScope; canViewTechnicalDetails?: boolean }
