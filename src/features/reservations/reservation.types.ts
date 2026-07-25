import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
import type { AccessScope } from "@/features/access-control/domain/access-control";
export type ReservationDateField = "stay" | "checkIn" | "checkOut";
export interface ReservationConflictSummary { id: string; guestName: string | null; startDate: Date; endDate: Date; provider: CalendarProviderType; status: ReservationStatus; calendarSourceName: string }
export interface ReservationListItem { id: string; guestName: string | null; startDate: Date; endDate: Date; provider: CalendarProviderType; status: ReservationStatus; propertyName: string; roomName: string; activeConflictCount: number; activeConflicts: ReservationConflictSummary[] }
export interface ReservationFilters { propertyId?: string; roomId?: string; provider?: CalendarProviderType; status?: ReservationStatus; dateField?: ReservationDateField; from: Date; toExclusive: Date; page: number; companyIds?: readonly string[]; accessScope?: AccessScope }
