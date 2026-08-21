import type { CalendarConnectionStatus, CalendarProviderType, SyncStatus } from "@/lib/generated/prisma/enums";
import type { CalendarFeedQuarantineReason } from "@/features/calendar-sync/domain/calendar-feed-safety";

export interface CalendarSourceListItem { id: string; roomId: string; roomName: string; propertyId: string; propertyName: string; provider: CalendarProviderType; name: string; maskedUrl: string; isActive: boolean; connectionStatus: CalendarConnectionStatus; safetyReasonCodes: CalendarFeedQuarantineReason[]; lastSyncedAt: Date | null; lastSuccessfulSyncAt: Date | null; lastFailedSyncAt: Date | null; latestSyncStatus: SyncStatus | null; latestSyncStartedAt: Date | null; latestSyncCompletedAt: Date | null; latestFetchedCount: number; latestCreatedCount: number; latestUpdatedCount: number; latestCancelledCount: number; activeConflictCount: number; isSyncing: boolean }
export interface CalendarRoomOption { id: string; name: string; propertyId: string; propertyName: string; isActive: boolean; propertyIsActive: boolean }
export interface CalendarSourceFilters { propertyId?: string; roomId?: string; provider?: CalendarProviderType; isActive?: boolean; companyIds?: readonly string[] }
export interface CalendarConnectionResult { provider: string; responseTimeMs: number; fetchedAt: string; contentType: string | null; eventCount: number; uidCount: number; startCount: number; endCount: number; summaryCount: number; reservationCount: number; blockedCount: number; cancelledCount: number; unknownCount: number }
export interface CalendarDraftConnectionResult extends CalendarConnectionResult { submittedUrl: string; normalizedUrl: string }
export interface CalendarSourceUrlReplacementActionData { warning: boolean; removedReservationCount: number; createdReservationCount: number; fetchedCount: number }
export interface CalendarSourceDeleteImpact { reservationCount: number; conflictCount: number; syncLogCount: number; cleaningTaskCount: number }
export interface CalendarSourceDeleteResult extends CalendarSourceDeleteImpact { calendarSourceId: string; sourceName: string; provider: CalendarProviderType; detachedCleaningTaskCount: number }
export interface CalendarSourceDeleteTarget {
  id: string;
  roomId: string;
  roomName: string;
  propertyId: string;
  propertyName: string;
  companyId: string;
  provider: CalendarProviderType;
  sourceName: string;
}
