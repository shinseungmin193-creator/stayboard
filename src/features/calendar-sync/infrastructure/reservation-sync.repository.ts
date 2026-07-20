import "server-only";
import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { ExistingReservation, NormalizedReservation } from "../domain/normalized-reservation";
import { classifyReservations, shouldProtectEmptyCalendar } from "../domain/classify-reservations";

export function findCalendarSourceForSync(id: string) { return prisma.calendarSource.findUnique({ where: { id }, select: { id: true, provider: true, calendarUrl: true, isActive: true, roomId: true, room: { select: { propertyId: true, property: { select: { companyId: true } } } } } }); }
export function createRunningSyncLog(calendarSourceId: string, startedAt: Date) { return prisma.syncLog.create({ data: { calendarSourceId, status: "RUNNING", startedAt }, select: { id: true } }); }
export function failSyncLog(id: string, completedAt: Date, errorMessage: string, fetchedCount: number) { return prisma.syncLog.update({ where: { id }, data: { status: "FAILED", completedAt, errorMessage, fetchedCount } }); }

function persistenceData(reservation: NormalizedReservation) { return { providerReservationId: reservation.providerReservationId, guestName: reservation.guestName, startDate: reservation.startDate, endDate: reservation.endDate, status: reservation.status, summary: reservation.summary, description: reservation.description, providerCreatedAt: reservation.providerCreatedAt, providerUpdatedAt: reservation.providerUpdatedAt }; }

export async function persistReservationSync(input: { syncLogId: string; calendarSourceId: string; propertyId: string; roomId: string; provider: CalendarProviderType; reservations: NormalizedReservation[]; fetchedCount: number; syncStartedAt: Date; completedAt: Date }) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.reservation.findMany({ where: { calendarSourceId: input.calendarSourceId }, select: { id: true, rawUid: true, providerReservationId: true, guestName: true, startDate: true, endDate: true, status: true, summary: true, description: true, providerCreatedAt: true, providerUpdatedAt: true, createdAt: true } });
    const existing: ExistingReservation[] = rows;
    const activeExistingCount = existing.filter((reservation) => reservation.status !== "CANCELLED").length;
    if (shouldProtectEmptyCalendar(input.fetchedCount, activeExistingCount)) throw new EmptyCalendarProtectionError();
    const classification = classifyReservations(existing, input.reservations, input.syncStartedAt);
    const created = classification.create.length ? await tx.reservation.createMany({ data: classification.create.map((reservation) => ({ ...persistenceData(reservation), rawUid: reservation.rawUid, calendarSourceId: input.calendarSourceId, propertyId: input.propertyId, roomId: input.roomId, provider: input.provider })), skipDuplicates: true }) : { count: 0 };
    for (const item of classification.update) await tx.reservation.update({ where: { id: item.id }, data: persistenceData(item.reservation) });
    const cancelled = classification.cancelIds.length ? await tx.reservation.updateMany({ where: { id: { in: classification.cancelIds }, status: { not: "CANCELLED" as ReservationStatus } }, data: { status: "CANCELLED" } }) : { count: 0 };
    await tx.syncLog.update({ where: { id: input.syncLogId }, data: { status: "SUCCESS", completedAt: input.completedAt, fetchedCount: input.fetchedCount, createdCount: created.count, updatedCount: classification.update.length, cancelledCount: cancelled.count, errorMessage: null } });
    await tx.calendarSource.update({ where: { id: input.calendarSourceId }, data: { lastSyncedAt: input.completedAt } });
    return { createdCount: created.count, updatedCount: classification.update.length, unchangedCount: classification.unchanged.length, cancelledCount: cancelled.count };
  });
}

export class EmptyCalendarProtectionError extends Error { constructor() { super("수신된 캘린더가 비어 있어 기존 예약을 보호했습니다."); this.name = "EmptyCalendarProtectionError"; } }
