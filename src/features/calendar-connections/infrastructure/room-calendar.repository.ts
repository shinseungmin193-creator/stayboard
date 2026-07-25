import "server-only";

import { prisma } from "@/lib/prisma";
import type { RoomCalendarFilters } from "../types/room-calendar-summary";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";

export function findRoomCalendarRows(filters: RoomCalendarFilters) {
  return prisma.room.findMany({
    where: {
      id: filters.roomId,
      propertyId: filters.propertyId,
      property: filters.companyIds ? { companyId: { in: [...filters.companyIds] } } : undefined,
      calendarSources: filters.provider ? { some: { provider: filters.provider } } : undefined,
    },
    select: {
      id: true,
      name: true,
      propertyId: true,
      property: { select: { name: true } },
      calendarSources: {
        where: { provider: { in: [...CALENDAR_PROVIDER_TYPES] } },
        select: {
          id: true,
          provider: true,
          name: true,
          calendarUrl: true,
          isActive: true,
          lastSyncedAt: true,
        },
        orderBy: [{ isActive: "desc" }, { provider: "asc" }, { name: "asc" }],
      },
      _count: { select: { reservations: { where: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } } } } },
      conflicts: { where: { status: "ACTIVE", reservationA: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, reservationB: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } } }, select: { id: true } },
      syncRuns: {
        select: {
          id: true, status: true, executionMode: true, startedAt: true, finishedAt: true, targetCount: true, successCount: true, failedCount: true, errorSummary: true,
          actor: { select: { name: true } },
          syncLogs: { select: { calendarSourceId: true, provider: true, status: true, startedAt: true, completedAt: true, fetchedCount: true, blockedEventCount: true, unknownEventCount: true, createdCount: true, updatedCount: true, cancelledCount: true, retryCount: true, httpStatus: true, errorCode: true, errorMessage: true, errorDetails: true, durationMs: true } },
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: 20,
      },
    },
    orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
}
