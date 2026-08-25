import "server-only";
import { detectRoomReservationConflicts } from "@/features/reservation-conflicts/infrastructure/reservation-conflict.repository";
import { syncCleaningTasksForCalendarSource } from "@/features/cleaning/server/cleaning-task-sync.service";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CALENDAR_SYNC_STALE_MESSAGE, CALENDAR_SYNC_STALE_RUNNING_MS } from "../calendar-sync.constants";
import type { CalendarEventClassificationCounts } from "../domain/classify-calendar-events";
import { classifyReservations } from "../domain/classify-reservations";
import type { ExistingReservation, NormalizedReservation } from "../domain/normalized-reservation";
import type { CalendarFeedFingerprint } from "../domain/calendar-feed-fingerprint";
import type { CalendarFeedSafetyDiagnostics, CalendarFeedQuarantineReason } from "../domain/calendar-feed-safety";
import { removeCalendarSourceReservations } from "./calendar-source-reservation-removal";

export function findCalendarSourceForSync(id: string) {
  return prisma.calendarSource.findUnique({ where: { id }, select: { id: true, provider: true, calendarUrl: true, isActive: true, connectionStatus: true, roomId: true, room: { select: { propertyId: true, property: { select: { companyId: true } } } } } });
}

export function createRunningSyncLog(calendarSourceId: string, provider: CalendarProviderType, startedAt: Date, syncRunId?: string) {
  return prisma.syncLog.create({ data: { calendarSourceId, provider, syncRunId, status: "RUNNING", startedAt }, select: { id: true } });
}

export function failSyncLog(id: string, startedAt: Date, completedAt: Date, error: { code: string; safeMessage: string; technicalMessage: string; httpStatus: number | null; retryCount: number }, fetchedCount: number, eventCounts: CalendarEventClassificationCounts, unknownEventDetails: Prisma.InputJsonValue = [], eventDiagnostics: Prisma.InputJsonValue = {}, safety?: { calendarSourceId: string; fingerprint: CalendarFeedFingerprint; diagnostics: CalendarFeedSafetyDiagnostics; reasonCodes: CalendarFeedQuarantineReason[] }) {
  return prisma.$transaction(async (tx) => {
    const log = await tx.syncLog.update({ where: { id }, data: { status: "FAILED", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), errorCode: error.code, errorMessage: error.safeMessage, errorDetails: error.technicalMessage, httpStatus: error.httpStatus, retryCount: error.retryCount, fetchedCount, ...eventCounts, unknownEventDetails, eventDiagnostics, quarantined: Boolean(safety), feedFingerprint: safety?.fingerprint as unknown as Prisma.InputJsonValue | undefined, safetyDiagnostics: safety?.diagnostics as unknown as Prisma.InputJsonValue | undefined } });
    if (safety) await tx.calendarSource.update({ where: { id: safety.calendarSourceId }, data: { connectionStatus: "RECONNECT_REQUIRED", safetyReasonCodes: safety.reasonCodes as unknown as Prisma.InputJsonValue } });
    return log;
  });
}

export function markStaleRunningSyncLogs(calendarSourceId: string, now: Date) {
  return prisma.syncLog.updateMany({ where: { calendarSourceId, status: "RUNNING", startedAt: { lt: new Date(now.getTime() - CALENDAR_SYNC_STALE_RUNNING_MS) } }, data: { status: "TIMEOUT", completedAt: now, errorMessage: CALENDAR_SYNC_STALE_MESSAGE } });
}

export function reservationPersistenceData(reservation: NormalizedReservation) {
  return { providerReservationId: reservation.providerReservationId, guestName: reservation.guestName, startDate: reservation.startDate, endDate: reservation.endDate, status: reservation.status, summary: reservation.summary, description: reservation.description, providerCreatedAt: reservation.providerCreatedAt, providerUpdatedAt: reservation.providerUpdatedAt };
}

interface PersistReservationSyncInput {
  syncLogId: string;
  calendarSourceId: string;
  propertyId: string;
  companyId: string;
  roomId: string;
  provider: CalendarProviderType;
  reservations: NormalizedReservation[];
  observedUids: string[];
  fullyParsed: boolean;
  unknownEventDetails: Prisma.InputJsonValue;
  eventDiagnostics: Prisma.InputJsonValue;
  eventCounts: CalendarEventClassificationCounts;
  fetchedCount: number;
  syncStartedAt: Date;
  completedAt: Date;
  feedFingerprint: CalendarFeedFingerprint;
  safetyDiagnostics: CalendarFeedSafetyDiagnostics;
}

export async function persistReservationSync(input: PersistReservationSyncInput) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.reservation.findMany({ where: { calendarSourceId: input.calendarSourceId }, select: { id: true, rawUid: true, providerReservationId: true, guestName: true, startDate: true, endDate: true, status: true, summary: true, description: true, providerCreatedAt: true, providerUpdatedAt: true, createdAt: true } });
    const existing: ExistingReservation[] = rows;

    const classification = classifyReservations(existing, input.reservations, {
      observedUids: new Set(input.observedUids),
      fullyParsed: input.fullyParsed,
    });
    const statusById = new Map(existing.map((reservation) => [reservation.id, reservation.status]));
    const explicitCancelledCount = classification.update.filter((item) => item.reservation.status === "CANCELLED" && statusById.get(item.id) !== "CANCELLED").length;
    const created = classification.create.length ? await tx.reservation.createMany({ data: classification.create.map((reservation) => ({ ...reservationPersistenceData(reservation), rawUid: reservation.rawUid, calendarSourceId: input.calendarSourceId, createdBySyncLogId: input.syncLogId, propertyId: input.propertyId, roomId: input.roomId, provider: input.provider })), skipDuplicates: true }) : { count: 0 };
    for (const item of classification.update) await tx.reservation.update({ where: { id: item.id }, data: reservationPersistenceData(item.reservation) });
    const removed = await removeCalendarSourceReservations(tx, {
      calendarSourceId: input.calendarSourceId,
      reservationIds: classification.missingDeletionIds,
    });
    await syncCleaningTasksForCalendarSource(tx, {
      calendarSourceId: input.calendarSourceId,
      companyId: input.companyId,
      propertyId: input.propertyId,
      roomId: input.roomId,
    });
    const conflicts = await detectRoomReservationConflicts(tx, input.roomId);
    const cancelledCount = explicitCancelledCount + removed.reservationCount;
    await tx.syncLog.update({ where: { id: input.syncLogId }, data: { status: "SUCCESS", completedAt: input.completedAt, durationMs: input.completedAt.getTime() - input.syncStartedAt.getTime(), fetchedCount: input.fetchedCount, ...input.eventCounts, unknownEventDetails: input.unknownEventDetails, eventDiagnostics: input.eventDiagnostics, feedFingerprint: input.feedFingerprint as unknown as Prisma.InputJsonValue, safetyDiagnostics: input.safetyDiagnostics as unknown as Prisma.InputJsonValue, quarantined: false, createdCount: created.count, updatedCount: classification.update.length, cancelledCount, errorCode: null, errorMessage: null, errorDetails: null } });
    await tx.calendarSource.update({ where: { id: input.calendarSourceId }, data: { lastSyncedAt: input.completedAt, connectionStatus: "NORMAL", safetyReasonCodes: Prisma.JsonNull, feedFingerprint: input.feedFingerprint as unknown as Prisma.InputJsonValue, feedFingerprintUpdatedAt: input.completedAt } });
    return { createdCount: created.count, updatedCount: classification.update.length, unchangedCount: classification.unchanged.length, cancelledCount, ...conflicts };
  });
}
