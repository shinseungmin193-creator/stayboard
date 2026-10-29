import { performance } from "node:perf_hooks";
import { addDays } from "date-fns";

import { prisma } from "../src/lib/prisma";
import { getDashboardSummary } from "../src/features/dashboard/dashboard.repository";
import { DASHBOARD_RECENT_SYNC_FAILURE_HOURS } from "../src/features/dashboard/dashboard.constants";
import { getDashboardTodayRange } from "../src/features/dashboard/dashboard-time";
import { getCleaningDashboardSummary } from "../src/features/cleaning/server/cleaning-dashboard.repository";
import { buildOperationalReservationWhere } from "../src/features/reservations/operational-reservation-where";
import { buildReservationOverlapWhere } from "../src/features/reservations/reservation-range-overlap";
import { getDefaultReservationConflictRange } from "../src/features/reservation-conflicts/domain/reservation-conflict-range";
import { buildActiveReservationConflictWhere, countActiveReservationConflicts } from "../src/features/reservation-conflicts/infrastructure/active-reservation-conflict.repository";
import { calculateOverlapRange, isCurrentReservationConflict } from "../src/features/reservation-conflicts/domain/reservation-conflict";
import { buildRoomOperationalSchedule, getReservationOperationalDay } from "../src/features/room-overview/domain/room-overview";
import { CALENDAR_PROVIDER_TYPES } from "../src/providers/calendar/types";
import type { AccessScope } from "../src/features/access-control/domain/access-control";
import { roomScopeWhere } from "../src/features/access-control/infrastructure/prisma-scope";

const RUNS = 5;

async function getLegacyDashboardSummary(
  now: Date,
  companyIds?: readonly string[],
  accessScope?: AccessScope,
) {
  const today = getDashboardTodayRange(now);
  const calendarStart = addDays(today.start, -3);
  const queryEnd = addDays(today.end, 7);
  const conflictRange = getDefaultReservationConflictRange(now);
  const recentSince = new Date(now.getTime() - DASHBOARD_RECENT_SYNC_FAILURE_HOURS * 60 * 60 * 1000);
  const companyProperty = companyIds ? { companyId: { in: [...companyIds] } } : undefined;
  const scopedRoom = roomScopeWhere(accessScope) ?? { property: companyProperty };

  const [rooms] = await Promise.all([
    prisma.room.findMany({
      where: {
        ...(roomScopeWhere(accessScope) ?? {}),
        isActive: true,
        property: {
          isActive: true,
          company: { isActive: true },
          companyId: companyIds ? { in: [...companyIds] } : undefined,
        },
      },
      select: {
        id: true,
        roomNotes: { where: { status: "OPEN" }, select: { id: true } },
        cleaningTasks: {
          where: { scheduledDate: { gte: today.start, lt: today.end }, status: { not: "CANCELLED" } },
          select: { status: true },
        },
        reservations: {
          where: {
            ...buildOperationalReservationWhere(),
            ...buildReservationOverlapWhere({ viewStart: calendarStart, viewEnd: queryEnd }),
          },
          select: { id: true, guestName: true, provider: true, status: true, startDate: true, endDate: true },
          orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
        },
        conflicts: {
          where: {
            status: "ACTIVE",
            overlapEnd: { gt: calendarStart },
            overlapStart: { lt: queryEnd },
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
          select: {
            id: true,
            provider: true,
            syncLogs: {
              select: { status: true, startedAt: true, completedAt: true },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
            },
          },
        },
      },
    }),
    prisma.reservationConflict.findMany({
      where: {
        status: "ACTIVE",
        reservationA: buildOperationalReservationWhere(),
        reservationB: buildOperationalReservationWhere(),
        room: {
          AND: [
            roomScopeWhere(accessScope) ?? {},
            {
              isActive: true,
              property: {
                isActive: true,
                company: { isActive: true },
                companyId: companyIds ? { in: [...companyIds] } : undefined,
              },
            },
          ],
        },
        overlapStart: { lt: queryEnd },
        overlapEnd: { gte: today.start, gt: calendarStart },
      },
      select: { id: true },
    }),
  ]);

  const [recentSyncFailures, latestSync, cleaning, activeConflicts] = await Promise.all([
    prisma.syncLog.count({
      where: {
        calendarSource: { room: scopedRoom },
        status: { in: ["FAILED", "TIMEOUT"] },
        startedAt: { gte: recentSince },
      },
    }),
    prisma.syncLog.findFirst({
      where: {
        calendarSource: { room: scopedRoom },
        status: { in: ["SUCCESS", "FAILED", "TIMEOUT"] },
      },
      select: { status: true, completedAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    getCleaningDashboardSummary({ start: today.start, end: today.end, companyIds, accessScope }),
    countActiveReservationConflicts({
      from: conflictRange.from,
      toExclusive: conflictRange.toExclusive,
      todayStart: conflictRange.todayStart,
      companyIds,
      accessScope,
    }),
  ]);

  const scheduleReservations = rooms.flatMap((room) => room.reservations.map((reservation) => ({
    ...reservation,
    activeConflicts: [],
    roomId: room.id,
    roomName: room.id,
    hasConflict: false,
  })));
  const schedule = buildRoomOperationalSchedule(scheduleReservations, today.start, today.end, queryEnd);
  const conflictedCheckIns = rooms.filter((room) => {
    const currentConflicts = room.conflicts.filter(isCurrentReservationConflict).filter((conflict) => {
      const overlap = calculateOverlapRange(conflict.reservationA, conflict.reservationB);
      return overlap ? overlap.overlapEnd > today.start : false;
    });
    return currentConflicts.length > 0 && room.reservations.some((reservation) => (
      getReservationOperationalDay({ ...reservation, activeConflicts: [] }, today.start, today.end).isTodayCheckIn
    ));
  }).length;

  return {
    todayCheckIns: schedule.todayCheckIns.length,
    todayCheckOuts: schedule.todayCheckOuts.length,
    registeredRooms: rooms.length,
    activeConflicts,
    conflictedCheckIns,
    recentSyncFailures,
    latestSync,
    priorityCleaning: cleaning.priority,
    flexibleCleaning: cleaning.flexible,
    completedCleaning: cleaning.completed,
    activeCleaning: cleaning.active,
    totalCleaning: cleaning.total,
  };
}

const comparableSummary = (summary: Awaited<ReturnType<typeof getDashboardSummary>>) => ({
  todayCheckIns: summary.todayCheckIns,
  todayCheckOuts: summary.todayCheckOuts,
  registeredRooms: summary.registeredRooms,
  activeConflicts: summary.activeConflicts,
  conflictedCheckIns: summary.conflictedCheckIns,
  recentSyncFailures: summary.recentSyncFailures,
  latestSync: summary.latestSync,
  priorityCleaning: summary.priorityCleaning,
  flexibleCleaning: summary.flexibleCleaning,
  completedCleaning: summary.completedCleaning,
  activeCleaning: summary.activeCleaning,
  totalCleaning: summary.totalCleaning,
});

async function measure<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  const value = await operation();
  return { value, durationMs: performance.now() - startedAt };
}

const summarizeDurations = (values: readonly number[]) => ({
  runs: values.length,
  averageMs: Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100,
  minMs: Math.round(Math.min(...values) * 100) / 100,
  maxMs: Math.round(Math.max(...values) * 100) / 100,
});

async function main() {
  const now = new Date();
  const scopeSeed = await prisma.company.findFirst({
    where: { isActive: true, properties: { some: { isActive: true, rooms: { some: { isActive: true } } } } },
    select: { id: true, properties: { where: { isActive: true, rooms: { some: { isActive: true } } }, select: { id: true }, take: 1 } },
  });
  const scenarios: Array<{ label: string; companyIds?: readonly string[]; accessScope?: AccessScope }> = [
    { label: "all" },
  ];
  if (scopeSeed) {
    scenarios.push({
      label: "company",
      companyIds: [scopeSeed.id],
      accessScope: { mode: "companies", companyIds: [scopeSeed.id] },
    });
    const propertyId = scopeSeed.properties[0]?.id;
    if (propertyId) {
      scenarios.push({
        label: "property",
        companyIds: [scopeSeed.id],
        accessScope: { mode: "companies", companyIds: [scopeSeed.id], propertyIds: [propertyId] },
      });
    }
  }

  let allScopesMatch = true;
  const results = [];
  for (const scenario of scenarios) {
    await getLegacyDashboardSummary(now, scenario.companyIds, scenario.accessScope);
    await getDashboardSummary(now, scenario.companyIds, scenario.accessScope);
    const legacyDurations: number[] = [];
    const optimizedDurations: number[] = [];
    let parity = true;

    for (let run = 0; run < RUNS; run += 1) {
      const legacy = await measure(() => getLegacyDashboardSummary(now, scenario.companyIds, scenario.accessScope));
      const optimized = await measure(() => getDashboardSummary(now, scenario.companyIds, scenario.accessScope));
      legacyDurations.push(legacy.durationMs);
      optimizedDurations.push(optimized.durationMs);
      parity &&= JSON.stringify(legacy.value) === JSON.stringify(comparableSummary(optimized.value));
    }
    allScopesMatch &&= parity;
    results.push({
      scope: scenario.label,
      parity,
      legacy: summarizeDurations(legacyDurations),
      optimized: summarizeDurations(optimizedDurations),
    });
  }

  console.log(JSON.stringify({
    parity: allScopesMatch,
    legacyPrismaOperations: 6,
    optimizedPrismaOperations: 5,
    results,
  }));

  if (!allScopesMatch) process.exitCode = 1;
}

void main();
