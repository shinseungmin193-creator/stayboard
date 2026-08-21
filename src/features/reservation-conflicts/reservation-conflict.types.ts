import type { CalendarProviderType, ReservationConflictStatus, ReservationStatus } from "@/lib/generated/prisma/enums";
import type { AccessScope } from "@/features/access-control";
import type { ReservationConflictViewStatus } from "./domain/reservation-conflict-dismissal";

export interface ConflictScopeFilters { propertyId?: string; roomId?: string; provider?: CalendarProviderType; from: Date; toExclusive: Date; companyIds?: readonly string[]; accessScope?: AccessScope }
export interface ConflictFilters extends ConflictScopeFilters { status: ReservationConflictViewStatus; todayStart: Date; page: number }
export interface ConflictReservationItem { id: string; guestName: string | null; provider: CalendarProviderType; status: ReservationStatus; startDate: Date; endDate: Date; calendarSourceName: string }
export interface ConflictListItem { id: string; status: ReservationConflictStatus; overlapStart: Date; overlapEnd: Date; detectedAt: Date; isPast: boolean; roomName: string; propertyName: string; reservationA: ConflictReservationItem; reservationB: ConflictReservationItem }
export interface ConflictListResult { items: ConflictListItem[]; totalCount: number; totalPages: number; page: number; dismissibleCount: number }

export interface ConflictBulkDismissalInput {
  propertyId?: string;
  roomId?: string;
  provider?: CalendarProviderType;
  from: string;
  to: string;
}
