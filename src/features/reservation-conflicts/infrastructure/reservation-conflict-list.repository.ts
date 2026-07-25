import "server-only";
import { prisma } from "@/lib/prisma";
import { RESERVATION_CONFLICT_PAGE_SIZE } from "../reservation-conflict.constants";
import type { ConflictFilters, ConflictListItem } from "../reservation-conflict.types";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import { roomScopeWhere } from "@/features/access-control";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";

const reservationSelect = { id: true, guestName: true, provider: true, status: true, startDate: true, endDate: true, calendarSource: { select: { name: true } } } as const;
export async function listReservationConflicts(filters: ConflictFilters): Promise<{ items: ConflictListItem[]; totalCount: number; totalPages: number; page: number }> {
  const where: Prisma.ReservationConflictWhereInput = { status: filters.status, roomId: filters.roomId, reservationA: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, reservationB: { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, room: { ...(roomScopeWhere(filters.accessScope) ?? {}), propertyId: filters.propertyId, property: filters.companyIds ? { companyId: { in: [...filters.companyIds] } } : undefined }, overlapStart: { lt: filters.toExclusive }, overlapEnd: { gt: filters.from }, OR: filters.provider ? [{ reservationA: { provider: filters.provider } }, { reservationB: { provider: filters.provider } }] : undefined };
  const totalCount = await prisma.reservationConflict.count({ where }); const totalPages = Math.max(1, Math.ceil(totalCount / RESERVATION_CONFLICT_PAGE_SIZE)); const page = Math.min(filters.page, totalPages);
  const rows = await prisma.reservationConflict.findMany({ where, select: { id: true, status: true, overlapStart: true, overlapEnd: true, detectedAt: true, room: { select: { name: true, property: { select: { name: true } } } }, reservationA: { select: reservationSelect }, reservationB: { select: reservationSelect } }, orderBy: [{ overlapStart: "asc" }, { id: "asc" }], skip: (page - 1) * RESERVATION_CONFLICT_PAGE_SIZE, take: RESERVATION_CONFLICT_PAGE_SIZE });
  return { items: rows.map(({ room, reservationA, reservationB, ...conflict }) => ({ ...conflict, roomName: formatRoomDisplayName(room), propertyName: room.property.name, reservationA: { ...reservationA, calendarSourceName: reservationA.calendarSource.name }, reservationB: { ...reservationB, calendarSourceName: reservationB.calendarSource.name } })), totalCount, totalPages, page };
}
