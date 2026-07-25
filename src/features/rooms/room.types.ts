import type { CalendarProviderType, SyncStatus } from "@/lib/generated/prisma/enums";

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
}
