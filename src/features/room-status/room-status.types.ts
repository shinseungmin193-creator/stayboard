import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";

export interface RoomStatusReservation {
  id: string;
  guestName: string | null;
  summary: string | null;
  startDate: Date;
  endDate: Date;
  provider: CalendarProviderType;
  status: ReservationStatus;
  calendarSourceName: string;
  hasActiveConflict: boolean;
}

export interface RoomStatusRoom {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
  sources: Array<{ id: string; name: string; provider: CalendarProviderType }>;
  reservations: RoomStatusReservation[];
}
