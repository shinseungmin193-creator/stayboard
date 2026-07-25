import "server-only";
import { prisma } from "@/lib/prisma";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { CALENDAR_SYNC_STALE_RUNNING_MS } from "@/features/calendar-sync/calendar-sync.constants";
import type { CalendarRoomOption, CalendarSourceFilters } from "./calendar-source.types";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";

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
    select: { id: true, roomId: true, provider: true, name: true, calendarUrl: true, isActive: true, lastSyncedAt: true, room: { select: { name: true, propertyId: true, property: { select: { name: true } } } } },
    orderBy: [{ isActive: "desc" }, { room: { property: { name: "asc" } } }, { room: { name: "asc" } }, { provider: "asc" }, { name: "asc" }],
  });
  if (!sources.length) return [];
  const ids = sources.map((source) => source.id);
  const [states, conflictCounts] = await Promise.all([
    findCalendarSourceSyncStates(ids),
    prisma.reservationConflict.findMany({ where: { status: "ACTIVE", OR: [{ reservationA: { calendarSourceId: { in: ids } } }, { reservationB: { calendarSourceId: { in: ids } } }], reservationA: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, reservationB: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } } }, select: { reservationA: { select: { calendarSourceId: true } }, reservationB: { select: { calendarSourceId: true } } } }),
  ]);
  const stateById = new Map(states.map((state) => [state.sourceId, state])); const conflictBySource = new Map<string, number>(); for (const conflict of conflictCounts) { const affected = new Set([conflict.reservationA.calendarSourceId, conflict.reservationB.calendarSourceId]); for (const sourceId of affected) conflictBySource.set(sourceId, (conflictBySource.get(sourceId) ?? 0) + 1); } const staleCutoff = Date.now() - CALENDAR_SYNC_STALE_RUNNING_MS;
  return sources.map((source) => { const state = stateById.get(source.id); return { ...source, lastSuccessfulSyncAt: state?.lastSuccessfulSyncAt ?? null, lastFailedSyncAt: state?.lastFailedSyncAt ?? null, latestSyncStatus: state?.latestSyncStatus ?? null, latestSyncStartedAt: state?.latestSyncStartedAt ?? null, latestSyncCompletedAt: state?.latestSyncCompletedAt ?? null, latestFetchedCount: state?.latestFetchedCount ?? 0, latestCreatedCount: state?.latestCreatedCount ?? 0, latestUpdatedCount: state?.latestUpdatedCount ?? 0, latestCancelledCount: state?.latestCancelledCount ?? 0, activeConflictCount: conflictBySource.get(source.id) ?? 0, isSyncing: state?.latestSyncStatus === "RUNNING" && Boolean(state.latestSyncStartedAt && state.latestSyncStartedAt.getTime() >= staleCutoff) }; });
}
export async function listCalendarRoomOptions(companyIds?: readonly string[], accessScope?: AccessScope): Promise<CalendarRoomOption[]> { const rooms = await prisma.room.findMany({ where: { ...(roomScopeWhere(accessScope) ?? {}), property: companyIds ? { companyId: { in: [...companyIds] } } : undefined }, select: { id: true, name: true, propertyId: true, isActive: true, property: { select: { name: true, isActive: true } } }, orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] }); return rooms.map(({ property, ...room }) => ({ ...room, name: formatRoomDisplayName(room), propertyName: property.name, propertyIsActive: property.isActive })); }
export function findCalendarSource(id: string) { return prisma.calendarSource.findUnique({ where: { id }, select: { id: true, roomId: true, provider: true, name: true, calendarUrl: true, isActive: true, room: { select: { property: { select: { companyId: true } } } } } }); }
export function findCalendarRoom(id: string) { return prisma.room.findUnique({ where: { id }, select: { id: true, propertyId: true, property: { select: { id: true, companyId: true } } } }); }
export function findDuplicateCalendarUrl(roomId: string, calendarUrl: string, excludeId?: string) { return prisma.calendarSource.findFirst({ where: { roomId, calendarUrl, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } }); }
export function createCalendarSource(data: { roomId: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean }) { return prisma.calendarSource.create({ data, select: { id: true } }); }
export function updateCalendarSource(id: string, data: { roomId: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean }) { return prisma.calendarSource.update({ where: { id }, data, select: { id: true } }); }
export function setCalendarSourceActive(id: string, isActive: boolean) { return prisma.calendarSource.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
export function listActiveCalendarSourceIdsForSync(filters: CalendarSourceFilters, take: number) { if (filters.isActive === false) return Promise.resolve([]); return prisma.calendarSource.findMany({ where: { isActive: true, roomId: filters.roomId, provider: filters.provider ?? { in: [...CALENDAR_PROVIDER_TYPES] }, room: { propertyId: filters.propertyId, property: filters.companyIds ? { companyId: { in: [...filters.companyIds] } } : undefined } }, select: { id: true, roomId: true, provider: true }, orderBy: { id: "asc" }, take }); }
export function listActiveCalendarSourceIdsForRooms(roomIds: readonly string[], take: number, companyIds?: readonly string[]) {
  const uniqueRoomIds = [...new Set(roomIds)];
  if (!uniqueRoomIds.length) return Promise.resolve([]);
  return prisma.calendarSource.findMany({
    where: {
      isActive: true,
      roomId: { in: uniqueRoomIds },
      provider: { in: [...CALENDAR_PROVIDER_TYPES] },
      room: { property: companyIds ? { companyId: { in: [...companyIds] } } : undefined },
    },
    select: { id: true, roomId: true, provider: true },
    orderBy: { id: "asc" },
    take,
  });
}
