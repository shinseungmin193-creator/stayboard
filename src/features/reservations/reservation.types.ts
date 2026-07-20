import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
export interface ReservationListItem { id: string; guestName: string | null; startDate: Date; endDate: Date; provider: CalendarProviderType; status: ReservationStatus; propertyName: string; roomName: string }
export interface ReservationFilters { propertyId?: string; roomId?: string; provider?: CalendarProviderType; status?: ReservationStatus; from: Date; toExclusive: Date; page: number }
