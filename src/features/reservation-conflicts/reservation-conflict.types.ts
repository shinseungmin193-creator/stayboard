import type { CalendarProviderType, ReservationConflictStatus, ReservationStatus } from "@/lib/generated/prisma/enums";
import type { AccessScope } from "@/features/access-control";
export interface ConflictFilters { propertyId?: string; roomId?: string; provider?: CalendarProviderType; status: ReservationConflictStatus; from: Date; toExclusive: Date; page: number; companyIds?: readonly string[]; accessScope?: AccessScope }
export interface ConflictReservationItem { id: string; guestName: string | null; provider: CalendarProviderType; status: ReservationStatus; startDate: Date; endDate: Date; calendarSourceName: string }
export interface ConflictListItem { id: string; status: ReservationConflictStatus; overlapStart: Date; overlapEnd: Date; detectedAt: Date; roomName: string; propertyName: string; reservationA: ConflictReservationItem; reservationB: ConflictReservationItem }
