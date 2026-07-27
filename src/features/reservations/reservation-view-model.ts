import type { CalendarProviderType, ReservationStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import type { ReservationListItem } from "./reservation.types";
import { getReservationDisplayStatus, type ReservationDisplayStatus } from "./reservation-display-status";

export interface ReservationConflictViewModel {
  id: string;
  guestName: string | null;
  startDate: string;
  endDate: string;
  provider: CalendarProviderType;
  status: ReservationStatus;
  calendarSourceName: string;
}

export interface ReservationViewModel {
  id: string;
  guestName: string | null;
  providerReservationId: string | null;
  summary: string | null;
  description: string | null;
  startDate: string;
  endDate: string;
  provider: CalendarProviderType;
  status: ReservationStatus;
  displayStatus: ReservationDisplayStatus;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomName: string;
  calendarSourceName: string;
  latestSyncStatus: SyncStatus | null;
  latestSyncCompletedAt: string | null;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeConflictCount: number;
  activeConflicts: ReservationConflictViewModel[];
}

export function toReservationViewModel(item: ReservationListItem, businessDate = new Date()): ReservationViewModel {
  return {
    ...item,
    displayStatus: getReservationDisplayStatus({
      reservationStatus: item.status,
      startDate: item.startDate,
      endDate: item.endDate,
      businessDate,
    }),
    startDate: item.startDate.toISOString(),
    endDate: item.endDate.toISOString(),
    latestSyncCompletedAt: item.latestSyncCompletedAt?.toISOString() ?? null,
    providerCreatedAt: item.providerCreatedAt?.toISOString() ?? null,
    providerUpdatedAt: item.providerUpdatedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    activeConflicts: item.activeConflicts.map((conflict) => ({
      ...conflict,
      startDate: conflict.startDate.toISOString(),
      endDate: conflict.endDate.toISOString(),
    })),
  };
}
