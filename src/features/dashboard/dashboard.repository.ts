import "server-only";

import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { DASHBOARD_RECENT_SYNC_FAILURE_HOURS } from "./dashboard.constants";
import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control/infrastructure/prisma-scope";
import { getCleaningDashboardSummary } from "@/features/cleaning/server/cleaning-dashboard.repository";
import { getDefaultReservationConflictRange } from "@/features/reservation-conflicts/domain/reservation-conflict-range";
import { getDashboardTodayRange } from "./dashboard-time";
import { measureDashboardPrismaOperation, measureDashboardStage } from "./dashboard-performance";
import { summarizeDashboardReservationMetrics } from "./dashboard-reservation-metrics";
import { findDashboardConflicts, findDashboardRoomReservationRows } from "./dashboard-reservation.repository";

export async function getDashboardSummary(
  now = new Date(),
  companyIds?: readonly string[],
  accessScope?: AccessScope,
  options: { includeSyncFailures?: boolean } = {},
) {
  const includeSyncFailures = options.includeSyncFailures ?? true;
  const recentSince = new Date(now.getTime() - DASHBOARD_RECENT_SYNC_FAILURE_HOURS * 60 * 60 * 1000);
  const companyProperty = companyIds ? { companyId: { in: [...companyIds] } } : undefined;
  const scopedRoom = roomScopeWhere(accessScope) ?? { property: companyProperty };
  const today = getDashboardTodayRange(now);
  const conflictRange = getDefaultReservationConflictRange(now);
  const [rooms, conflicts, cleaning, syncLogs] = await Promise.all([
    measureDashboardStage("rooms", () => measureDashboardPrismaOperation(
      "Room",
      "findMany",
      () => findDashboardRoomReservationRows({
        todayStart: today.start,
        todayEnd: today.end,
        companyIds,
        accessScope,
      }),
    )),
    measureDashboardStage("conflicts", () => measureDashboardPrismaOperation(
      "ReservationConflict",
      "findMany",
      () => findDashboardConflicts({
        from: conflictRange.from,
        toExclusive: conflictRange.toExclusive,
        companyIds,
        accessScope,
      }),
    )),
    measureDashboardStage("cleaning", () => measureDashboardPrismaOperation(
      "CleaningTask",
      "findMany",
      () => getCleaningDashboardSummary({
        start: today.start,
        end: today.end,
        companyIds,
        accessScope,
      }),
    )),
    measureDashboardStage("sync-logs", async () => {
      if (!includeSyncFailures) return { recentSyncFailures: 0, latestSync: null };
      const [recentSyncFailures, latestSync] = await Promise.all([
        measureDashboardPrismaOperation("SyncLog", "count", () => (
          prisma.syncLog.count({ where: { calendarSource: { room: scopedRoom }, status: { in: ["FAILED", "TIMEOUT"] }, startedAt: { gte: recentSince } } })
        )),
        measureDashboardPrismaOperation("SyncLog", "findFirst", () => (
          prisma.syncLog.findFirst({ where: { calendarSource: { room: scopedRoom }, status: { in: ["SUCCESS", "FAILED", "TIMEOUT"] } }, select: { status: true, completedAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })
        )),
      ]);
      return { recentSyncFailures, latestSync };
    }),
  ]);
  const reservationMetrics = summarizeDashboardReservationMetrics({
    rooms,
    conflicts,
    todayStart: today.start,
    todayEnd: today.end,
    roomOverviewConflictStart: addDays(today.start, -3),
    roomOverviewConflictEnd: addDays(today.end, 7),
  });

  return {
    todayCheckIns: reservationMetrics.todayCheckIns,
    todayCheckOuts: reservationMetrics.todayCheckOuts,
    registeredRooms: reservationMetrics.registeredRooms,
    activeConflicts: reservationMetrics.activeConflicts,
    conflictedCheckIns: reservationMetrics.conflictedCheckIns,
    recentSyncFailures: syncLogs.recentSyncFailures,
    latestSync: syncLogs.latestSync,
    recentFailureHours: DASHBOARD_RECENT_SYNC_FAILURE_HOURS,
    priorityCleaning: cleaning.priority,
    flexibleCleaning: cleaning.flexible,
    completedCleaning: cleaning.completed,
    activeCleaning: cleaning.active,
    totalCleaning: cleaning.total,
    priorityCleaningRooms: cleaning.priorityRooms,
    flexibleCleaningRooms: cleaning.flexibleRooms,
    completedCleaningRooms: cleaning.completedRooms,
  };
}
