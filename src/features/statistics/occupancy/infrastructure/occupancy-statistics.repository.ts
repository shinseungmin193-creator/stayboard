import "server-only";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";

export function findOccupancyStatisticsRooms(input: { propertyId?: string; companyIds?: readonly string[]; accessScope?: AccessScope; from: Date; toExclusive: Date }) {
  return prisma.room.findMany({
    where: { ...(roomScopeWhere(input.accessScope) ?? {}), isActive: true, property: { isActive: true, companyId: input.companyIds ? { in: [...input.companyIds] } : undefined }, propertyId: input.propertyId },
    select: {
      id: true, propertyId: true, name: true, sortOrder: true,
      property: { select: { name: true } },
      reservations: { where: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] }, endDate: { gt: input.from }, startDate: { lt: input.toExclusive } }, select: { status: true, startDate: true, endDate: true } },
      conflicts: { where: { status: "ACTIVE", reservationA: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, reservationB: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } } }, select: { id: true } },
    },
    orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
}
