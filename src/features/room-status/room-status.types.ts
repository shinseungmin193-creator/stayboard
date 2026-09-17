import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
import type { ReservationConflictPeer } from "@/features/reservation-conflicts/domain/reservation-conflict";

export interface RoomStatusReservation {
  id: string;
  providerReservationId: string | null;
  guestName: string | null;
  summary: string | null;
  startDate: Date;
  endDate: Date;
  provider: CalendarProviderType;
  status: ReservationStatus;
  calendarSourceName: string;
  activeConflicts: ReservationConflictPeer[];
}

export interface RoomStatusRoom {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
  sources: Array<{ id: string; name: string; provider: CalendarProviderType }>;
  reservations: RoomStatusReservation[];
}
