import "server-only";

import { prisma } from "@/lib/prisma";
import { getReservationOperationalDay, listRoomOverview } from "@/features/room-overview";
import { DASHBOARD_RECENT_SYNC_FAILURE_HOURS } from "./dashboard.constants";
import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control/infrastructure/prisma-scope";
import { getCleaningDashboardSummary } from "@/features/cleaning/server/cleaning-dashboard.repository";
import { getDefaultReservationConflictRange } from "@/features/reservation-conflicts/domain/reservation-conflict-range";
import { countActiveReservationConflicts } from "@/features/reservation-conflicts/infrastructure/active-reservation-conflict.repository";

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
  const roomOverview = await listRoomOverview({ companyIds, accessScope }, now);
  const conflictRange = getDefaultReservationConflictRange(now);
  const [recentSyncFailures, latestSync, cleaning, activeConflicts] = await Promise.all([
    includeSyncFailures
      ? prisma.syncLog.count({ where: { calendarSource: { room: scopedRoom }, status: { in: ["FAILED", "TIMEOUT"] }, startedAt: { gte: recentSince } } })
      : Promise.resolve(0),
    includeSyncFailures
      ? prisma.syncLog.findFirst({ where: { calendarSource: { room: scopedRoom }, status: { in: ["SUCCESS", "FAILED", "TIMEOUT"] } }, select: { status: true, completedAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })
      : Promise.resolve(null),
    getCleaningDashboardSummary({ start: roomOverview.todayStart, end: roomOverview.todayEnd, companyIds, accessScope }),
    countActiveReservationConflicts({
      from: conflictRange.from,
      toExclusive: conflictRange.toExclusive,
      todayStart: conflictRange.todayStart,
      companyIds,
      accessScope,
    }),
  ]);
  const conflictedCheckIns = roomOverview.allCards.filter((card) => (
    card.activeConflictCount > 0
    && card.reservations.some((reservation) => getReservationOperationalDay(
      reservation,
      roomOverview.todayStart,
      roomOverview.todayEnd,
    ).isTodayCheckIn)
  )).length;

  return {
    todayCheckIns: roomOverview.operationalSchedule.todayCheckIns.length,
    todayCheckOuts: roomOverview.operationalSchedule.todayCheckOuts.length,
    registeredRooms: roomOverview.summary.total,
    activeConflicts,
    conflictedCheckIns,
    recentSyncFailures,
    latestSync,
    recentFailureHours: DASHBOARD_RECENT_SYNC_FAILURE_HOURS,
    priorityCleaning: cleaning.priority,
    flexibleCleaning: cleaning.flexible,
    priorityCleaningRooms: cleaning.priorityRooms,
    flexibleCleaningRooms: cleaning.flexibleRooms,
  };
}
