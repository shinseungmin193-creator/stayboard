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
