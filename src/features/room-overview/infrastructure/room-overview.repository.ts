import "server-only";

import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";

export function findRoomOverviewData(input: { propertyId?: string; operationalStatus?: "NONE" | "CLEANING_REQUIRED" | "INSPECTION_REQUIRED"; companyIds?: readonly string[]; accessScope?: AccessScope; from: Date; toExclusive: Date }) {
  return prisma.room.findMany({
    where: { ...(roomScopeWhere(input.accessScope) ?? {}), isActive: true, property: { isActive: true, companyId: input.companyIds ? { in: [...input.companyIds] } : undefined }, propertyId: input.propertyId, operationalStatus: input.operationalStatus },
    select: {
      id: true, propertyId: true, name: true, code: true, sortOrder: true, operationalStatus: true, operationalStatusUpdatedAt: true,
      property: { select: { name: true } },
      reservations: {
        where: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] }, endDate: { gt: input.from }, startDate: { lt: input.toExclusive } },
        select: { id: true, guestName: true, provider: true, status: true, startDate: true, endDate: true },
        orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
      },
      conflicts: { where: { status: "ACTIVE", reservationA: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, reservationB: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } } }, select: { id: true } },
      calendarSources: {
        where: { isActive: true, provider: { in: [...CALENDAR_PROVIDER_TYPES] } },
        select: {
          id: true, provider: true,
          syncLogs: { select: { status: true, startedAt: true, completedAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
        },
        orderBy: [{ provider: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { code: "asc" }, { name: "asc" }],
  });
}

export function findUpcomingRoomOverviewConflicts(input: { propertyId?: string; companyIds?: readonly string[]; accessScope?: AccessScope; from: Date; toExclusive: Date }) {
  return prisma.reservationConflict.findMany({
    where: { status: "ACTIVE", reservationA: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, reservationB: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, room: { ...(roomScopeWhere(input.accessScope) ?? {}), propertyId: input.propertyId, property: input.companyIds ? { companyId: { in: [...input.companyIds] } } : undefined }, overlapStart: { lt: input.toExclusive }, overlapEnd: { gt: input.from } },
    select: {
      id: true, overlapStart: true, overlapEnd: true,
      room: { select: { id: true, name: true } },
      reservationA: { select: { id: true, guestName: true, provider: true, status: true, startDate: true, endDate: true } },
      reservationB: { select: { id: true, guestName: true, provider: true, status: true, startDate: true, endDate: true } },
    },
    orderBy: [{ overlapStart: "asc" }, { id: "asc" }],
  });
}
