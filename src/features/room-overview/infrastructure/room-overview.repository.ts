import "server-only";

import { performance } from "node:perf_hooks";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { SyncStatus } from "@/lib/generated/prisma/enums";
import type { AccessScope } from "@/features/access-control/domain/access-control";
import { roomScopeWhere } from "@/features/access-control/infrastructure/prisma-scope";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import { buildReservationOverlapWhere } from "@/features/reservations/reservation-range-overlap";
import { OPEN_ROOM_NOTE_STATUS } from "@/features/room-notes/domain/room-note";

interface RoomOverviewLatestSync {
  calendarSourceId: string;
  status: SyncStatus;
  startedAt: Date;
  completedAt: Date | null;
}

async function measureRoomOverviewQuery<T>(query: string, operation: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    if (process.env.ROOM_OVERVIEW_PERFORMANCE_LOG === "true") {
      console.info("[room-overview.query]", JSON.stringify({
        query,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      }));
    }
  }
}

function findLatestRoomOverviewSyncs(calendarSourceIds: readonly string[]) {
  if (!calendarSourceIds.length) return Promise.resolve([] as RoomOverviewLatestSync[]);

  return measureRoomOverviewQuery("latest-syncs", () => prisma.$queryRaw<RoomOverviewLatestSync[]>(Prisma.sql`
    SELECT
      source.id AS "calendarSourceId",
      latest.status,
      latest."startedAt",
      latest."completedAt"
    FROM "CalendarSource" source
    JOIN LATERAL (
      SELECT status, "startedAt", "completedAt"
      FROM "SyncLog"
      WHERE "calendarSourceId" = source.id
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE source.id IN (${Prisma.join([...calendarSourceIds])})
  `));
}

export async function findRoomOverviewData(input: { propertyId?: string; operationalStatus?: "NONE" | "CLEANING_REQUIRED" | "INSPECTION_REQUIRED"; companyIds?: readonly string[]; accessScope?: AccessScope; from: Date; todayStart: Date; todayEnd: Date; toExclusive: Date }) {
  const rooms = await measureRoomOverviewQuery("rooms", () => prisma.room.findMany({
    where: {
      ...(roomScopeWhere(input.accessScope) ?? {}),
      isActive: true,
      property: { isActive: true, company: { isActive: true }, companyId: input.companyIds ? { in: [...input.companyIds] } : undefined },
      propertyId: input.propertyId,
      ...(input.operationalStatus === "INSPECTION_REQUIRED"
        ? { roomNotes: { some: { status: OPEN_ROOM_NOTE_STATUS } } }
        : { operationalStatus: input.operationalStatus }),
    },
    select: {
      id: true, propertyId: true, name: true, code: true, sortOrder: true, operationalStatus: true, operationalStatusUpdatedAt: true,
      property: { select: { name: true } },
      _count: { select: { roomNotes: true } },
      roomNotes: {
        where: { status: OPEN_ROOM_NOTE_STATUS },
        select: { acknowledgedAt: true, processedAt: true },
      },
      cleaningTasks: {
        where: {
          scheduledDate: { gte: input.todayStart, lt: input.todayEnd },
          status: { not: "CANCELLED" },
        },
        select: { status: true },
      },
      reservations: {
        where: {
          ...buildOperationalReservationWhere(),
          ...buildReservationOverlapWhere({ viewStart: input.from, viewEnd: input.toExclusive }),
        },
        select: { id: true, providerReservationId: true, calendarSourceId: true, guestName: true, provider: true, status: true, startDate: true, endDate: true },
        orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
      },
      conflicts: {
        where: {
          status: "ACTIVE",
          overlapEnd: { gt: input.from },
          overlapStart: { lt: input.toExclusive },
          reservationA: buildOperationalReservationWhere(),
          reservationB: buildOperationalReservationWhere(),
        },
        select: {
          id: true,
          reservationA: { select: { id: true, roomId: true, guestName: true, provider: true, status: true, startDate: true, endDate: true } },
          reservationB: { select: { id: true, roomId: true, guestName: true, provider: true, status: true, startDate: true, endDate: true } },
        },
      },
      calendarSources: {
        where: { isActive: true, provider: { in: [...CALENDAR_PROVIDER_TYPES] } },
        select: { id: true, provider: true },
        orderBy: [{ provider: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { code: "asc" }, { name: "asc" }],
  }));

  if (!rooms.length) return [];
  const latestSyncs = await findLatestRoomOverviewSyncs(
    rooms.flatMap((room) => room.calendarSources.map((source) => source.id)),
  );
  const latestSyncBySourceId = new Map(
    latestSyncs.map(({ calendarSourceId, ...sync }) => [calendarSourceId, sync]),
  );

  return rooms.map((room) => ({
    ...room,
    calendarSources: room.calendarSources.map((source) => {
      const latestSync = latestSyncBySourceId.get(source.id);
      return { ...source, syncLogs: latestSync ? [latestSync] : [] };
    }),
  }));
}

export function findUpcomingRoomOverviewConflicts(input: { propertyId?: string; companyIds?: readonly string[]; accessScope?: AccessScope; from: Date; todayStart: Date; toExclusive: Date }) {
  return prisma.reservationConflict.findMany({
    where: { status: "ACTIVE", reservationA: buildOperationalReservationWhere(), reservationB: buildOperationalReservationWhere(), room: { AND: [roomScopeWhere(input.accessScope) ?? {}, { isActive: true, propertyId: input.propertyId, property: { isActive: true, company: { isActive: true }, ...(input.companyIds ? { companyId: { in: [...input.companyIds] } } : {}) } }] }, overlapStart: { lt: input.toExclusive }, overlapEnd: { gte: input.todayStart, gt: input.from } },
    select: {
      id: true, overlapStart: true, overlapEnd: true,
      room: { select: { id: true, name: true } },
      reservationA: { select: { id: true, roomId: true, guestName: true, provider: true, status: true, startDate: true, endDate: true } },
      reservationB: { select: { id: true, roomId: true, guestName: true, provider: true, status: true, startDate: true, endDate: true } },
    },
    orderBy: [{ overlapStart: "asc" }, { id: "asc" }],
  });
}
