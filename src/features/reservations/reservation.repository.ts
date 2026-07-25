import "server-only";
import { prisma } from "@/lib/prisma";
import { ACTIVE_OTA_RESERVATION_STATUSES, RESERVATION_CONFLICT_DETAILS_PAGE_LIMIT, RESERVATION_PAGE_SIZE, reservationStatusesForFilter } from "./reservation.constants";
import type { ReservationFilters, ReservationListItem } from "./reservation.types";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import { roomScopeWhere } from "@/features/access-control";
import type { Prisma } from "@/lib/generated/prisma/client";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";

export async function listReservations(filters: ReservationFilters): Promise<{ items: ReservationListItem[]; totalCount: number; totalPages: number }> {
  const dateWhere: Prisma.ReservationWhereInput = filters.dateField === "checkIn"
    ? { startDate: { gte: filters.from, lt: filters.toExclusive } }
    : filters.dateField === "checkOut"
      ? { endDate: { gte: filters.from, lt: filters.toExclusive } }
      : { startDate: { lt: filters.toExclusive }, endDate: { gt: filters.from } };
  const where: Prisma.ReservationWhereInput = { propertyId: filters.propertyId, roomId: filters.roomId, provider: filters.provider ?? { in: [...CALENDAR_PROVIDER_TYPES] }, status: { in: [...reservationStatusesForFilter(filters.status, filters.dateField)] }, property: filters.companyIds ? { companyId: { in: [...filters.companyIds] } } : undefined, room: roomScopeWhere(filters.accessScope), ...dateWhere };
  const [rows, totalCount] = await Promise.all([prisma.reservation.findMany({ where, select: { id: true, guestName: true, startDate: true, endDate: true, provider: true, status: true, property: { select: { name: true } }, room: { select: { name: true } } }, orderBy: [{ startDate: "asc" }, { room: { name: "asc" } }], skip: (filters.page - 1) * RESERVATION_PAGE_SIZE, take: RESERVATION_PAGE_SIZE }), prisma.reservation.count({ where })]);
  const ids = rows.map((row) => row.id);
  const conflictWhere: Prisma.ReservationConflictWhereInput = { status: "ACTIVE", OR: [{ reservationAId: { in: ids } }, { reservationBId: { in: ids } }], reservationA: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, reservationB: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } } };
  const [conflictCounts, conflicts] = ids.length ? await Promise.all([
    prisma.reservationConflict.findMany({ where: conflictWhere, select: { reservationAId: true, reservationBId: true } }),
    prisma.reservationConflict.findMany({ where: conflictWhere, select: { reservationAId: true, reservationBId: true, reservationA: { select: { id: true, guestName: true, startDate: true, endDate: true, provider: true, status: true, calendarSource: { select: { name: true } } } }, reservationB: { select: { id: true, guestName: true, startDate: true, endDate: true, provider: true, status: true, calendarSource: { select: { name: true } } } } }, orderBy: { overlapStart: "asc" }, take: RESERVATION_CONFLICT_DETAILS_PAGE_LIMIT }),
  ]) : [[], []];
  const countById = new Map<string, number>(); for (const conflict of conflictCounts) { countById.set(conflict.reservationAId, (countById.get(conflict.reservationAId) ?? 0) + 1); countById.set(conflict.reservationBId, (countById.get(conflict.reservationBId) ?? 0) + 1); }
  const pageIds = new Set(ids); const detailsById = new Map<string, ReservationListItem["activeConflicts"]>();
  for (const conflict of conflicts) for (const [ownerId, other] of [[conflict.reservationAId, conflict.reservationB], [conflict.reservationBId, conflict.reservationA]] as const) if (pageIds.has(ownerId)) { const list = detailsById.get(ownerId) ?? []; list.push({ id: other.id, guestName: other.guestName, startDate: other.startDate, endDate: other.endDate, provider: other.provider, status: other.status, calendarSourceName: other.calendarSource.name }); detailsById.set(ownerId, list); }
  return { items: rows.map(({ property, room, ...reservation }) => ({ ...reservation, propertyName: property.name, roomName: formatRoomDisplayName(room), activeConflictCount: countById.get(reservation.id) ?? 0, activeConflicts: detailsById.get(reservation.id) ?? [] })), totalCount, totalPages: Math.max(1, Math.ceil(totalCount / RESERVATION_PAGE_SIZE)) };
}
