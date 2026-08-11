import "server-only";
import { prisma } from "@/lib/prisma";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { CALENDAR_SYNC_STALE_RUNNING_MS } from "@/features/calendar-sync/calendar-sync.constants";
import type { CalendarRoomOption, CalendarSourceDeleteImpact, CalendarSourceDeleteResult, CalendarSourceDeleteTarget, CalendarSourceFilters } from "./calendar-source.types";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";
import { isCalendarSourceDeleteConfirmationValid, isCalendarSourceSyncRunning } from "./domain/calendar-source-deletion";
import type { CalendarFeedFingerprint } from "@/features/calendar-sync/domain/calendar-feed-fingerprint";
import { readCalendarFeedQuarantineReasons, type CalendarFeedSafetyDiagnostics } from "@/features/calendar-sync/domain/calendar-feed-safety";

export interface CalendarSourceSyncState {
  sourceId: string;
  latestSyncStatus: "RUNNING" | "SUCCESS" | "FAILED" | "TIMEOUT" | null;
  latestSyncStartedAt: Date | null;
  latestSyncCompletedAt: Date | null;
  latestFetchedCount: number | null;
  latestCreatedCount: number | null;
  latestUpdatedCount: number | null;
  latestCancelledCount: number | null;
  latestErrorMessage: string | null;
  lastSuccessfulSyncAt: Date | null;
  lastFailedSyncAt: Date | null;
  latestFailedErrorMessage: string | null;
}

export function findCalendarSourceSyncStates(sourceIds: string[]) {
  if (!sourceIds.length) return Promise.resolve([] as CalendarSourceSyncState[]);
  return prisma.$queryRaw<CalendarSourceSyncState[]>(Prisma.sql`
    SELECT
      cs.id AS "sourceId",
      latest.status AS "latestSyncStatus",
      latest."startedAt" AS "latestSyncStartedAt",
      latest."completedAt" AS "latestSyncCompletedAt",
      latest."fetchedCount" AS "latestFetchedCount",
      latest."createdCount" AS "latestCreatedCount",
      latest."updatedCount" AS "latestUpdatedCount",
      latest."cancelledCount" AS "latestCancelledCount",
      latest."errorMessage" AS "latestErrorMessage",
      successful."completedAt" AS "lastSuccessfulSyncAt",
      failed."completedAt" AS "lastFailedSyncAt",
      failed."errorMessage" AS "latestFailedErrorMessage"
    FROM "CalendarSource" cs
    LEFT JOIN LATERAL (
      SELECT status, "startedAt", "completedAt", "fetchedCount", "createdCount",
        "updatedCount", "cancelledCount", "errorMessage"
      FROM "SyncLog"
      WHERE "calendarSourceId" = cs.id
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 1
    ) latest ON TRUE
    LEFT JOIN LATERAL (
      SELECT "completedAt"
      FROM "SyncLog"
      WHERE "calendarSourceId" = cs.id AND status = 'SUCCESS'
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 1
    ) successful ON TRUE
    LEFT JOIN LATERAL (
      SELECT "completedAt", "errorMessage"
      FROM "SyncLog"
      WHERE "calendarSourceId" = cs.id AND status IN ('FAILED', 'TIMEOUT')
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 1
    ) failed ON TRUE
    WHERE cs.id IN (${Prisma.join(sourceIds)})
  `);
}
export async function listCalendarSources(filters: CalendarSourceFilters) {
  const sources = await prisma.calendarSource.findMany({
    where: { roomId: filters.roomId, provider: filters.provider ?? { in: [...CALENDAR_PROVIDER_TYPES] }, isActive: filters.isActive, room: { propertyId: filters.propertyId, property: filters.companyIds ? { companyId: { in: [...filters.companyIds] } } : undefined } },
    select: { id: true, roomId: true, provider: true, name: true, calendarUrl: true, isActive: true, connectionStatus: true, safetyReasonCodes: true, lastSyncedAt: true, room: { select: { name: true, propertyId: true, property: { select: { name: true } } } } },
    orderBy: [{ isActive: "desc" }, { room: { property: { name: "asc" } } }, { room: { name: "asc" } }, { provider: "asc" }, { name: "asc" }],
  });
  if (!sources.length) return [];
  const ids = sources.map((source) => source.id);
  const [states, conflictCounts] = await Promise.all([
    findCalendarSourceSyncStates(ids),
    prisma.reservationConflict.findMany({ where: { status: "ACTIVE", OR: [{ reservationA: { calendarSourceId: { in: ids } } }, { reservationB: { calendarSourceId: { in: ids } } }], reservationA: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, reservationB: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } } }, select: { reservationA: { select: { calendarSourceId: true } }, reservationB: { select: { calendarSourceId: true } } } }),
  ]);
  const stateById = new Map(states.map((state) => [state.sourceId, state])); const conflictBySource = new Map<string, number>(); for (const conflict of conflictCounts) { const affected = new Set([conflict.reservationA.calendarSourceId, conflict.reservationB.calendarSourceId]); for (const sourceId of affected) conflictBySource.set(sourceId, (conflictBySource.get(sourceId) ?? 0) + 1); } const staleCutoff = Date.now() - CALENDAR_SYNC_STALE_RUNNING_MS;
  return sources.map((source) => { const state = stateById.get(source.id); return { ...source, safetyReasonCodes: readCalendarFeedQuarantineReasons(source.safetyReasonCodes), lastSuccessfulSyncAt: state?.lastSuccessfulSyncAt ?? null, lastFailedSyncAt: state?.lastFailedSyncAt ?? null, latestSyncStatus: state?.latestSyncStatus ?? null, latestSyncStartedAt: state?.latestSyncStartedAt ?? null, latestSyncCompletedAt: state?.latestSyncCompletedAt ?? null, latestFetchedCount: state?.latestFetchedCount ?? 0, latestCreatedCount: state?.latestCreatedCount ?? 0, latestUpdatedCount: state?.latestUpdatedCount ?? 0, latestCancelledCount: state?.latestCancelledCount ?? 0, activeConflictCount: conflictBySource.get(source.id) ?? 0, isSyncing: state?.latestSyncStatus === "RUNNING" && Boolean(state.latestSyncStartedAt && state.latestSyncStartedAt.getTime() >= staleCutoff) }; });
}
export async function listCalendarRoomOptions(companyIds?: readonly string[], accessScope?: AccessScope): Promise<CalendarRoomOption[]> { const rooms = await prisma.room.findMany({ where: { ...(roomScopeWhere(accessScope) ?? {}), property: companyIds ? { companyId: { in: [...companyIds] } } : undefined }, select: { id: true, name: true, propertyId: true, isActive: true, property: { select: { name: true, isActive: true } } }, orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] }); return rooms.map(({ property, ...room }) => ({ ...room, name: formatRoomDisplayName(room), propertyName: property.name, propertyIsActive: property.isActive })); }
export function findCalendarSource(id: string) { return prisma.calendarSource.findUnique({ where: { id }, select: { id: true, roomId: true, provider: true, name: true, calendarUrl: true, isActive: true, connectionStatus: true, safetyReasonCodes: true, feedFingerprint: true, room: { select: { propertyId: true, property: { select: { companyId: true } } } } } }); }
export async function findCalendarSourceDeleteTarget(id: string): Promise<CalendarSourceDeleteTarget | null> {
  const source = await prisma.calendarSource.findUnique({
    where: { id },
    select: {
      id: true,
      provider: true,
      name: true,
      roomId: true,
      room: {
        select: {
          name: true,
          propertyId: true,
          property: { select: { name: true, companyId: true } },
        },
      },
    },
  });
  if (!source) return null;
  return {
    id: source.id,
    roomId: source.roomId,
    roomName: formatRoomDisplayName(source.room),
    propertyId: source.room.propertyId,
    propertyName: source.room.property.name,
    companyId: source.room.property.companyId,
    provider: source.provider,
    sourceName: source.name,
  };
}

export async function countCalendarSourceDeleteImpact(calendarSourceId: string): Promise<CalendarSourceDeleteImpact> {
  const [reservationCount, conflictCount, syncLogCount, cleaningTaskCount] = await Promise.all([
    prisma.reservation.count({ where: { calendarSourceId } }),
    prisma.reservationConflict.count({
      where: {
        OR: [
          { reservationA: { calendarSourceId } },
          { reservationB: { calendarSourceId } },
        ],
      },
    }),
    prisma.syncLog.count({ where: { calendarSourceId } }),
    prisma.cleaningTask.count({ where: { reservation: { calendarSourceId } } }),
  ]);
  return { reservationCount, conflictCount, syncLogCount, cleaningTaskCount };
}

export type CalendarSourceDeletionRepositoryErrorCode = "NOT_FOUND" | "SCOPE_CHANGED" | "SYNC_IN_PROGRESS" | "CONFIRMATION_MISMATCH";
export class CalendarSourceDeletionRepositoryError extends Error {
  constructor(readonly code: CalendarSourceDeletionRepositoryErrorCode) {
    super(code);
    this.name = "CalendarSourceDeletionRepositoryError";
  }
}

export async function deleteCalendarSourceTransaction(input: {
  target: CalendarSourceDeleteTarget;
  actorUserId: string;
  confirmationText: string;
  auditMetadata: Prisma.InputJsonObject;
  now: Date;
}): Promise<CalendarSourceDeleteResult> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.calendarSource.findUnique({
      where: { id: input.target.id },
      select: {
        id: true,
        roomId: true,
        provider: true,
        name: true,
        room: { select: { name: true, propertyId: true, property: { select: { name: true, companyId: true } } } },
      },
    });
    if (!source) throw new CalendarSourceDeletionRepositoryError("NOT_FOUND");
    if (
      source.roomId !== input.target.roomId
      || source.room.propertyId !== input.target.propertyId
      || source.room.property.companyId !== input.target.companyId
    ) throw new CalendarSourceDeletionRepositoryError("SCOPE_CHANGED");
    if (!isCalendarSourceDeleteConfirmationValid(input.confirmationText)) {
      throw new CalendarSourceDeletionRepositoryError("CONFIRMATION_MISMATCH");
    }

    const runningSync = await tx.syncLog.findFirst({
      where: { calendarSourceId: source.id, status: "RUNNING" },
      select: { startedAt: true },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    });
    if (isCalendarSourceSyncRunning(runningSync?.startedAt ?? null, input.now, CALENDAR_SYNC_STALE_RUNNING_MS)) {
      throw new CalendarSourceDeletionRepositoryError("SYNC_IN_PROGRESS");
    }

    await tx.calendarSource.update({ where: { id: source.id }, data: { isActive: false } });
    const reservations = await tx.reservation.findMany({ where: { calendarSourceId: source.id }, select: { id: true } });
    const reservationIds = reservations.map((reservation) => reservation.id);
    const [conflictCount, syncLogCount, cleaningTaskCount] = await Promise.all([
      reservationIds.length
        ? tx.reservationConflict.count({ where: { OR: [{ reservationAId: { in: reservationIds } }, { reservationBId: { in: reservationIds } }] } })
        : Promise.resolve(0),
      tx.syncLog.count({ where: { calendarSourceId: source.id } }),
      reservationIds.length
        ? tx.cleaningTask.count({ where: { reservationId: { in: reservationIds } } })
        : Promise.resolve(0),
    ]);

    if (reservationIds.length) {
      await tx.reservationConflict.deleteMany({ where: { OR: [{ reservationAId: { in: reservationIds } }, { reservationBId: { in: reservationIds } }] } });
      await tx.cleaningTask.updateMany({ where: { reservationId: { in: reservationIds } }, data: { reservationId: null } });
      await tx.reservation.deleteMany({ where: { calendarSourceId: source.id } });
    }
    await tx.syncLog.deleteMany({ where: { calendarSourceId: source.id } });
    await tx.calendarSource.delete({ where: { id: source.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        targetCompanyId: input.target.companyId,
        action: "CALENDAR_SOURCE_DELETED",
        details: {
          ...input.auditMetadata,
          calendarSourceId: source.id,
          roomId: source.roomId,
          roomName: formatRoomDisplayName(source.room),
          propertyId: source.room.propertyId,
          propertyName: source.room.property.name,
          provider: source.provider,
          sourceName: source.name,
          reservationCount: reservations.length,
          conflictCount,
          syncLogCount,
          detachedCleaningTaskCount: cleaningTaskCount,
        },
      },
    });

    return {
      calendarSourceId: source.id,
      sourceName: source.name,
      provider: source.provider,
      reservationCount: reservations.length,
      conflictCount,
      syncLogCount,
      cleaningTaskCount,
      detachedCleaningTaskCount: cleaningTaskCount,
    };
  });
}
export function findCalendarRoom(id: string) { return prisma.room.findUnique({ where: { id }, select: { id: true, propertyId: true, property: { select: { id: true, companyId: true } } } }); }
export function findDuplicateCalendarUrl(roomId: string, calendarUrl: string, excludeId?: string) { return prisma.calendarSource.findFirst({ where: { roomId, calendarUrl, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } }); }
export function createCalendarSource(data: { roomId: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean; feedFingerprint: CalendarFeedFingerprint; feedFingerprintUpdatedAt: Date }) { return prisma.calendarSource.create({ data: { ...data, feedFingerprint: data.feedFingerprint as unknown as Prisma.InputJsonObject }, select: { id: true } }); }
export function updateCalendarSource(id: string, data: { roomId: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean }) { return prisma.calendarSource.update({ where: { id }, data, select: { id: true } }); }

export type CalendarSourceUrlReplacementRepositoryErrorCode = "NOT_FOUND" | "SCOPE_CHANGED" | "DUPLICATE";
export class CalendarSourceUrlReplacementRepositoryError extends Error {
  constructor(readonly code: CalendarSourceUrlReplacementRepositoryErrorCode) {
    super(code);
    this.name = "CalendarSourceUrlReplacementRepositoryError";
  }
}

export async function replaceCalendarSourceUrlTransaction(input: {
  calendarSourceId: string;
  expectedRoomId: string;
  expectedProvider: CalendarProviderType;
  expectedCompanyId: string;
  calendarUrl: string;
  fingerprint: CalendarFeedFingerprint;
  safetyDiagnostics: CalendarFeedSafetyDiagnostics;
  actorUserId: string;
  auditMetadata: Prisma.InputJsonObject;
  now: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.calendarSource.findUnique({
      where: { id: input.calendarSourceId },
      select: { id: true, roomId: true, provider: true, calendarUrl: true, room: { select: { property: { select: { companyId: true } } } } },
    });
    if (!source) throw new CalendarSourceUrlReplacementRepositoryError("NOT_FOUND");
    if (source.roomId !== input.expectedRoomId || source.provider !== input.expectedProvider || source.room.property.companyId !== input.expectedCompanyId) {
      throw new CalendarSourceUrlReplacementRepositoryError("SCOPE_CHANGED");
    }
    const duplicate = await tx.calendarSource.findFirst({
      where: { roomId: source.roomId, calendarUrl: input.calendarUrl, id: { not: source.id } },
      select: { id: true },
    });
    if (duplicate) throw new CalendarSourceUrlReplacementRepositoryError("DUPLICATE");

    const updated = await tx.calendarSource.update({
      where: { id: source.id },
      data: {
        calendarUrl: input.calendarUrl,
        connectionStatus: "NORMAL",
        safetyReasonCodes: Prisma.JsonNull,
        feedFingerprint: input.fingerprint as unknown as Prisma.InputJsonObject,
        feedFingerprintUpdatedAt: input.now,
      },
      select: { id: true, roomId: true, provider: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        targetCompanyId: input.expectedCompanyId,
        action: "CALENDAR_SOURCE_URL_REPLACED",
        details: {
          ...input.auditMetadata,
          calendarSourceId: source.id,
          roomId: source.roomId,
          provider: source.provider,
          previousHostname: new URL(source.calendarUrl).hostname,
          nextHostname: new URL(input.calendarUrl).hostname,
          safetyReasonCodes: input.safetyDiagnostics.reasonCodes,
        },
      },
    });
    return updated;
  });
}
export function setCalendarSourceActive(id: string, isActive: boolean) { return prisma.calendarSource.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
export function listActiveCalendarSourceIdsForSync(filters: CalendarSourceFilters, take: number, accessScope?: AccessScope) { if (filters.isActive === false) return Promise.resolve([]); return prisma.calendarSource.findMany({ where: { isActive: true, roomId: filters.roomId, provider: filters.provider ?? { in: [...CALENDAR_PROVIDER_TYPES] }, room: { ...(roomScopeWhere(accessScope) ?? {}), propertyId: filters.propertyId, property: filters.companyIds ? { companyId: { in: [...filters.companyIds] } } : undefined } }, select: { id: true, roomId: true, provider: true }, orderBy: { id: "asc" }, take }); }
export function listActiveCalendarSourceIdsForRooms(roomIds: readonly string[], take: number, companyIds?: readonly string[], provider?: CalendarProviderType) {
  const uniqueRoomIds = [...new Set(roomIds)];
  if (!uniqueRoomIds.length) return Promise.resolve([]);
  return prisma.calendarSource.findMany({
    where: {
      isActive: true,
      roomId: { in: uniqueRoomIds },
      provider: provider ?? { in: [...CALENDAR_PROVIDER_TYPES] },
      room: { property: companyIds ? { companyId: { in: [...companyIds] } } : undefined },
    },
    select: { id: true, roomId: true, provider: true },
    orderBy: { id: "asc" },
    take,
  });
}

export function listActiveCalendarSourceIdsForOverview(input: { propertyId?: string; companyIds?: readonly string[]; accessScope?: AccessScope }, take: number) {
  return prisma.calendarSource.findMany({
    where: {
      isActive: true,
      provider: { in: [...CALENDAR_PROVIDER_TYPES] },
      room: {
        ...(roomScopeWhere(input.accessScope) ?? {}),
        isActive: true,
        propertyId: input.propertyId,
        property: {
          isActive: true,
          ...(input.companyIds ? { companyId: { in: [...input.companyIds] } } : {}),
        },
      },
    },
    select: { id: true, roomId: true, provider: true },
    orderBy: { id: "asc" },
    take,
  });
}
