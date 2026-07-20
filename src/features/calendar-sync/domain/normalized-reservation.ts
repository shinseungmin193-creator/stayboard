import type { ReservationStatus } from "@/lib/generated/prisma/enums";
export interface NormalizedReservation { rawUid: string; providerReservationId: string | null; guestName: string | null; startDate: Date; endDate: Date; status: ReservationStatus; summary: string | null; description: string | null; providerCreatedAt: Date | null; providerUpdatedAt: Date | null }
export interface ExistingReservation extends NormalizedReservation { id: string; createdAt: Date }
