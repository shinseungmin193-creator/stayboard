import "server-only";

import type { AccessScope } from "@/features/access-control/domain/access-control";
import { roomScopeWhere } from "@/features/access-control/infrastructure/prisma-scope";
import { buildReservationConflictValidityWhere } from "@/features/reservation-conflicts/infrastructure/active-reservation-conflict.repository";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import { prisma } from "@/lib/prisma";

interface DashboardScopeInput {
  companyIds?: readonly string[];
  accessScope?: AccessScope;
}

export function findDashboardRoomReservationRows(input: DashboardScopeInput & {
  todayStart: Date;
  todayEnd: Date;
}) {
  return prisma.room.findMany({
    where: {
      ...(roomScopeWhere(input.accessScope) ?? {}),
      isActive: true,
      property: {
        isActive: true,
        company: { isActive: true },
        companyId: input.companyIds ? { in: [...input.companyIds] } : undefined,
      },
    },
    select: {
      id: true,
      reservations: {
        where: {
          ...buildOperationalReservationWhere(),
          OR: [
            { startDate: { gte: input.todayStart, lt: input.todayEnd } },
            { endDate: { gte: input.todayStart, lt: input.todayEnd } },
          ],
        },
        select: {
          id: true,
          guestName: true,
          provider: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });
}

export function findDashboardConflicts(input: DashboardScopeInput & {
  from: Date;
  toExclusive: Date;
}) {
  return prisma.reservationConflict.findMany({
    where: {
      AND: [
        buildReservationConflictValidityWhere(input),
        { status: "ACTIVE" },
      ],
    },
    select: {
      id: true,
      roomId: true,
      overlapStart: true,
      overlapEnd: true,
      reservationA: {
        select: { id: true, roomId: true, status: true, startDate: true, endDate: true },
      },
      reservationB: {
        select: { id: true, roomId: true, status: true, startDate: true, endDate: true },
      },
    },
  });
}
