import "server-only";

import { prisma } from "@/lib/prisma";
import type { RoomCalendarFilters } from "../types/room-calendar-summary";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";
import { roomScopeWhere } from "@/features/access-control/infrastructure/prisma-scope";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import { buildActiveReservationBaseWhere } from "@/features/reservations/active-reservation-where";

export function findRoomCalendarRows(filters: RoomCalendarFilters) {
  return prisma.room.findMany({
    where: {
      ...(roomScopeWhere(filters.accessScope) ?? {}),
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
          connectionStatus: true,
          safetyReasonCodes: true,
          lastSyncedAt: true,
          _count: {
            select: {
              reservations: {
                where: {
                  status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] },
                  provider: { in: [...CALENDAR_PROVIDER_TYPES] },
                },
              },
            },
          },
          reservations: {
            where: buildActiveReservationBaseWhere(new Date()),
            select: { id: true },
          },
        },
        orderBy: [{ isActive: "desc" }, { provider: "asc" }, { name: "asc" }],
      },
      _count: { select: { reservations: { where: buildOperationalReservationWhere() } } },
      conflicts: { where: { status: "ACTIVE", reservationA: buildOperationalReservationWhere(), reservationB: buildOperationalReservationWhere() }, select: { id: true } },
      syncRuns: {
        select: {
          id: true, status: true, executionMode: true, startedAt: true, finishedAt: true, targetCount: true, successCount: true, failedCount: true, errorSummary: true,
          actor: { select: { name: true } },
          syncLogs: { select: { calendarSourceId: true, provider: true, status: true, startedAt: true, completedAt: true, fetchedCount: true, reservationEventCount: true, blockedEventCount: true, cancelledEventCount: true, unknownEventCount: true, failedEventCount: true, createdCount: true, updatedCount: true, cancelledCount: true, retryCount: true, httpStatus: true, errorCode: true, errorMessage: true, errorDetails: true, durationMs: true } },
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: 20,
      },
    },
    orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
}
