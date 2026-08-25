import "server-only";
import { prisma } from "@/lib/prisma";
import { RESERVATION_CONFLICT_DETAILS_PAGE_LIMIT, RESERVATION_PAGE_SIZE } from "./reservation.constants";
import type { ReservationFilters, ReservationListItem } from "./reservation.types";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { Prisma } from "@/lib/generated/prisma/client";
import { buildActiveReservationWhere, buildScopedActiveReservationWhere } from "./active-reservation-where";
import { buildOperationalReservationWhere } from "./operational-reservation-where";

export async function listReservations(filters: ReservationFilters): Promise<{ items: ReservationListItem[]; totalCount: number; totalPages: number; page: number }> {
  const where = buildActiveReservationWhere(filters);
  const [rows, totalCount] = await Promise.all([
    prisma.reservation.findMany({
      where,
      select: {
        id: true,
        guestName: true,
        providerReservationId: true,
        summary: true,
        description: true,
        startDate: true,
        endDate: true,
        provider: true,
        status: true,
        propertyId: true,
        roomId: true,
        providerCreatedAt: true,
        providerUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
        property: { select: { name: true } },
        room: { select: { name: true } },
        calendarSource: {
          select: {
            name: true,
            syncLogs: {
              select: { status: true, completedAt: true },
              orderBy: { startedAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { room: { name: "asc" } }],
      skip: (filters.page - 1) * RESERVATION_PAGE_SIZE,
      take: RESERVATION_PAGE_SIZE,
    }),
    prisma.reservation.count({ where }),
  ]);
  const ids = rows.map((row) => row.id);
  const conflictWhere: Prisma.ReservationConflictWhereInput = { status: "ACTIVE", OR: [{ reservationAId: { in: ids } }, { reservationBId: { in: ids } }], reservationA: buildOperationalReservationWhere(), reservationB: buildOperationalReservationWhere() };
  const [conflictCounts, conflicts] = ids.length ? await Promise.all([
    prisma.reservationConflict.findMany({ where: conflictWhere, select: { reservationAId: true, reservationBId: true } }),
    prisma.reservationConflict.findMany({ where: conflictWhere, select: { reservationAId: true, reservationBId: true, reservationA: { select: { id: true, guestName: true, startDate: true, endDate: true, provider: true, status: true, calendarSource: { select: { name: true } } } }, reservationB: { select: { id: true, guestName: true, startDate: true, endDate: true, provider: true, status: true, calendarSource: { select: { name: true } } } } }, orderBy: { overlapStart: "asc" }, take: RESERVATION_CONFLICT_DETAILS_PAGE_LIMIT }),
  ]) : [[], []];
  const countById = new Map<string, number>(); for (const conflict of conflictCounts) { countById.set(conflict.reservationAId, (countById.get(conflict.reservationAId) ?? 0) + 1); countById.set(conflict.reservationBId, (countById.get(conflict.reservationBId) ?? 0) + 1); }
  const pageIds = new Set(ids); const detailsById = new Map<string, ReservationListItem["activeConflicts"]>();
  for (const conflict of conflicts) for (const [ownerId, other] of [[conflict.reservationAId, conflict.reservationB], [conflict.reservationBId, conflict.reservationA]] as const) if (pageIds.has(ownerId)) { const list = detailsById.get(ownerId) ?? []; list.push({ id: other.id, guestName: other.guestName, startDate: other.startDate, endDate: other.endDate, provider: other.provider, status: other.status, calendarSourceName: other.calendarSource.name }); detailsById.set(ownerId, list); }
  return {
    items: rows.map(({ property, room, calendarSource, ...reservation }) => ({
      ...reservation,
      propertyName: property.name,
      roomName: formatRoomDisplayName(room),
      calendarSourceName: calendarSource.name,
      latestSyncStatus: calendarSource.syncLogs[0]?.status ?? null,
      latestSyncCompletedAt: calendarSource.syncLogs[0]?.completedAt ?? null,
      activeConflictCount: countById.get(reservation.id) ?? 0,
      activeConflicts: detailsById.get(reservation.id) ?? [],
    })),
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / RESERVATION_PAGE_SIZE)),
    page: filters.page,
  };
}

export async function hasScopedReservations(input: { businessDate: Date; companyIds?: readonly string[]; accessScope?: ReservationFilters["accessScope"] }): Promise<boolean> {
  const reservation = await prisma.reservation.findFirst({
    where: buildScopedActiveReservationWhere(input),
    select: { id: true },
  });
  return Boolean(reservation);
}
