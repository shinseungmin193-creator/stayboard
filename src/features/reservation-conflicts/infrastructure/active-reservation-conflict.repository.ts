import "server-only";

import { roomScopeWhere } from "@/features/access-control";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ConflictScopeFilters } from "../reservation-conflict.types";

export function buildReservationConflictValidityWhere(
  filters: ConflictScopeFilters,
): Prisma.ReservationConflictWhereInput {
  const roomScope = roomScopeWhere(filters.accessScope);
  return {
    roomId: filters.roomId,
    reservationA: buildOperationalReservationWhere(),
    reservationB: buildOperationalReservationWhere(),
    room: {
      AND: [
        roomScope ?? {},
        {
          isActive: true,
          propertyId: filters.propertyId,
          property: {
            isActive: true,
            ...(filters.companyIds ? { companyId: { in: [...filters.companyIds] } } : {}),
          },
        },
      ],
    },
    overlapStart: { lt: filters.toExclusive },
    overlapEnd: { gt: filters.from },
    OR: filters.provider
      ? [{ reservationA: { provider: filters.provider } }, { reservationB: { provider: filters.provider } }]
      : undefined,
  };
}

export function buildActiveReservationConflictWhere(
  filters: ConflictScopeFilters & { todayStart: Date },
): Prisma.ReservationConflictWhereInput {
  return {
    AND: [
      buildReservationConflictValidityWhere(filters),
      { status: "ACTIVE", overlapEnd: { gte: filters.todayStart } },
    ],
  };
}

export function countActiveReservationConflicts(
  filters: ConflictScopeFilters & { todayStart: Date },
) {
  return prisma.reservationConflict.count({
    where: buildActiveReservationConflictWhere(filters),
  });
}

