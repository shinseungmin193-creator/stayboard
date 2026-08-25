import "server-only";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";

export function findOccupancyStatisticsRooms(input: { propertyId?: string; companyIds?: readonly string[]; accessScope?: AccessScope; from: Date; toExclusive: Date }) {
  return prisma.room.findMany({
    where: { ...(roomScopeWhere(input.accessScope) ?? {}), isActive: true, property: { isActive: true, company: { isActive: true }, companyId: input.companyIds ? { in: [...input.companyIds] } : undefined }, propertyId: input.propertyId },
    select: {
      id: true, propertyId: true, name: true, sortOrder: true,
      property: { select: { name: true } },
      reservations: { where: { ...buildOperationalReservationWhere(), endDate: { gt: input.from }, startDate: { lt: input.toExclusive } }, select: { status: true, startDate: true, endDate: true } },
      conflicts: { where: { status: "ACTIVE", reservationA: buildOperationalReservationWhere(), reservationB: buildOperationalReservationWhere() }, select: { id: true } },
    },
    orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
}
