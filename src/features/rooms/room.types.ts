import type { CalendarProviderType, SyncStatus } from "@/lib/generated/prisma/enums";
import type { ReviewProviderType } from "@/features/reviews/domain/listing-provider";

export interface RoomCalendarSourceSummary {
  id: string;
  provider: CalendarProviderType;
  name: string;
  calendarUrl: string;
  isActive: boolean;
  lastSyncedAt: Date | null;
  latestSyncStatus: SyncStatus | null;
  latestSyncStartedAt: Date | null;
  latestSyncCompletedAt: Date | null;
  latestFetchedCount: number;
  latestErrorSummary: string | null;
  isSyncing: boolean;
}

export interface RoomListItem {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyIsActive: boolean;
  name: string;
  capacity: number;
  isActive: boolean;
  calendarSourceCount: number;
  calendarSources: RoomCalendarSourceSummary[];
  listingCount: number;
  listings: Array<{
    id: string;
    provider: ReviewProviderType;
    listingUrl: string;
    isActive: boolean;
  }>;
}

export interface RoomDeleteImpact {
  reservationCount: number;
  calendarSourceCount: number;
  syncHistoryCount: number;
  conflictCount: number;
  cleaningTaskCount: number;
  cleaningPhotoCount: number;
  roomNoteCount: number;
  roomListingCount: number;
  reviewDataCount: number;
  accessAssignmentCount: number;
}

export interface RoomDeleteTarget {
  id: string;
  propertyId: string;
  propertyName: string;
  companyId: string;
  name: string;
  calendarSourceIds: string[];
  roomListingIds: string[];
}

export interface RoomDeleteResult extends RoomDeleteImpact {
  roomId: string;
  roomName: string;
  propertyName: string;
  deletedPhotoFileCount: number;
  failedPhotoFileCount: number;
}
