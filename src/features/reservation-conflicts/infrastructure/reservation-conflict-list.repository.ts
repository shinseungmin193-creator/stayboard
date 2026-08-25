import "server-only";

import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { RESERVATION_CONFLICT_PAGE_SIZE } from "../reservation-conflict.constants";
import type { ConflictFilters, ConflictListResult, ConflictScopeFilters } from "../reservation-conflict.types";
import { isPastReservationConflict } from "../domain/reservation-conflict-dismissal";
import { buildActiveReservationConflictWhere, buildReservationConflictValidityWhere } from "./active-reservation-conflict.repository";

const reservationSelect = {
  id: true,
  guestName: true,
  provider: true,
  status: true,
  startDate: true,
  endDate: true,
  calendarSource: { select: { name: true } },
} as const;

export function buildReservationConflictScopeWhere(
  filters: ConflictScopeFilters,
): Prisma.ReservationConflictWhereInput {
  return buildReservationConflictValidityWhere(filters);
}

export function buildDismissibleReservationConflictWhere(
  filters: ConflictScopeFilters,
  todayStart: Date,
): Prisma.ReservationConflictWhereInput {
  return {
    AND: [
      buildReservationConflictScopeWhere(filters),
      { status: "ACTIVE", overlapEnd: { lt: todayStart } },
    ],
  };
}

function buildListStatusWhere(filters: ConflictFilters): Prisma.ReservationConflictWhereInput {
  if (filters.status === "ALL") return {};
  if (filters.status === "PAST") return { status: "ACTIVE", overlapEnd: { lt: filters.todayStart } };
  if (filters.status === "ACTIVE") return { status: "ACTIVE", overlapEnd: { gte: filters.todayStart } };
  return { status: filters.status };
}

export async function listReservationConflicts(filters: ConflictFilters): Promise<ConflictListResult> {
  const scopeWhere = buildReservationConflictScopeWhere(filters);
  const where: Prisma.ReservationConflictWhereInput = filters.status === "ACTIVE"
    ? buildActiveReservationConflictWhere(filters)
    : { AND: [scopeWhere, buildListStatusWhere(filters)] };
  const dismissibleWhere = buildDismissibleReservationConflictWhere(filters, filters.todayStart);
  const [totalCount, dismissibleCount] = await Promise.all([
    prisma.reservationConflict.count({ where }),
    prisma.reservationConflict.count({ where: dismissibleWhere }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / RESERVATION_CONFLICT_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const rows = await prisma.reservationConflict.findMany({
    where,
    select: {
      id: true,
      status: true,
      overlapStart: true,
      overlapEnd: true,
      detectedAt: true,
      room: { select: { name: true, property: { select: { name: true } } } },
      reservationA: { select: reservationSelect },
      reservationB: { select: reservationSelect },
    },
    orderBy: [{ overlapStart: "asc" }, { id: "asc" }],
    skip: (page - 1) * RESERVATION_CONFLICT_PAGE_SIZE,
    take: RESERVATION_CONFLICT_PAGE_SIZE,
  });
  return {
    items: rows.map(({ room, reservationA, reservationB, ...conflict }) => ({
      ...conflict,
      isPast: isPastReservationConflict(conflict.overlapEnd, filters.todayStart),
      roomName: formatRoomDisplayName(room),
      propertyName: room.property.name,
      reservationA: { ...reservationA, calendarSourceName: reservationA.calendarSource.name },
      reservationB: { ...reservationB, calendarSourceName: reservationB.calendarSource.name },
    })),
    totalCount,
    totalPages,
    page,
    dismissibleCount,
  };
}
