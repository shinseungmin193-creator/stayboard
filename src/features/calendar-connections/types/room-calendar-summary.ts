import type { CalendarProviderType, SyncExecutionMode, SyncStatus } from "@/lib/generated/prisma/enums";
import type { AccessScope } from "@/features/access-control/domain/access-control";

export type RoomCalendarStatus = "HEALTHY" | "WARNING" | "PARTIAL_FAILURE" | "FAILED" | "SYNCING" | "NOT_SYNCED" | "DISABLED";
export const ROOM_CALENDAR_STATUS_META = {
  HEALTHY: { label: "정상", className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: "check" },
  WARNING: { label: "주의", className: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300", icon: "warning" },
  PARTIAL_FAILURE: { label: "일부 오류", className: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300", icon: "warning" },
  FAILED: { label: "전체 오류", className: "border-destructive/40 bg-destructive/10 text-destructive", icon: "error" },
  SYNCING: { label: "동기화 중", className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: "loading" },
  NOT_SYNCED: { label: "동기화 전", className: "border-border bg-muted/50 text-muted-foreground", icon: "clock" },
  DISABLED: { label: "연결 없음", className: "border-border bg-muted/50 text-muted-foreground", icon: "off" },
} satisfies Record<RoomCalendarStatus, { label: string; className: string; icon: "check" | "warning" | "error" | "loading" | "clock" | "off" }>;

export const CALENDAR_PROVIDER_LABELS = { AIRBNB: "Airbnb", BOOKING: "Booking.com", AGODA: "Agoda", EXPEDIA: "Expedia", VRBO: "Vrbo", OTHER: "기타" } satisfies Record<CalendarProviderType, string>;

export interface CalendarSourceSummary {
  id: string; roomId: string; roomName: string; propertyId: string; propertyName: string; provider: CalendarProviderType; name: string; maskedUrl: string; isActive: boolean; lastSyncedAt: Date | null;
  latestSyncStatus: SyncStatus | null; latestSyncStartedAt: Date | null; latestSyncCompletedAt: Date | null; latestFetchedCount: number; latestCreatedCount: number; latestUpdatedCount: number; latestCancelledCount: number;
  latestReservationEventCount: number; latestBlockedCount: number; latestUnknownCount: number; latestFailedEventCount: number; latestRetryCount: number; latestHttpStatus: number | null; latestErrorCode: string | null; latestErrorMessage: string | null; latestErrorDetails: string | null; latestDurationMs: number | null; isSyncing: boolean; isWarning: boolean;
}

export interface SyncRunHistoryItem { id: string; startedAt: Date; finishedAt: Date | null; executionMode: SyncExecutionMode; targetCount: number; successCount: number; failedCount: number; status: RoomCalendarStatus; actorName: string; errorSummary: string | null }

export interface RoomCalendarSummary {
  roomId: string; roomName: string; propertyId: string; propertyName: string; sources: CalendarSourceSummary[]; providerCount: number; activeSourceCount: number; reservationCount: number; conflictCount: number; lastSyncedAt: Date | null; status: RoomCalendarStatus;
  latestRun: { id: string; targetCount: number; successCount: number; failedCount: number; startedAt: Date; finishedAt: Date | null } | null; history: SyncRunHistoryItem[]; failureSummaries: Array<{ provider: CalendarProviderType; message: string }>;
}

export interface RoomCalendarFilters { propertyId?: string; roomId?: string; provider?: CalendarProviderType; status?: RoomCalendarStatus; companyIds?: readonly string[]; accessScope?: AccessScope; canViewTechnicalDetails?: boolean }
