import type { CalendarProviderType, ReservationStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import type { AccessScope } from "@/features/access-control/domain/access-control";
import type { ActiveReservationDisplayStatus } from "./reservation-display-status";
import type { ReservationDateMode } from "./reservation-date-navigation";
export type ReservationDateField = "stay" | "checkIn" | "checkOut";
export interface ReservationConflictSummary { id: string; guestName: string | null; startDate: Date; endDate: Date; provider: CalendarProviderType; status: ReservationStatus; calendarSourceName: string }
export interface ReservationListItem {
  id: string;
  guestName: string | null;
  providerReservationId: string | null;
  summary: string | null;
  description: string | null;
  startDate: Date;
  endDate: Date;
  provider: CalendarProviderType;
  status: ReservationStatus;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomName: string;
  calendarSourceName: string;
  latestSyncStatus: SyncStatus | null;
  latestSyncCompletedAt: Date | null;
  providerCreatedAt: Date | null;
  providerUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  activeConflictCount: number;
  activeConflicts: ReservationConflictSummary[];
}

export interface ReservationFilters {
  search?: string;
  propertyId?: string;
  roomId?: string;
  providers?: readonly CalendarProviderType[];
  displayStatuses?: readonly ActiveReservationDisplayStatus[];
  businessDate: Date;
  dateField?: ReservationDateField;
  dateMode?: ReservationDateMode;
  from: Date;
  toExclusive: Date;
  hasConflict?: boolean;
  page: number;
  companyIds?: readonly string[];
  accessScope?: AccessScope;
}
