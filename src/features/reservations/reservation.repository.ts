import "server-only";
import { prisma } from "@/lib/prisma";
import { RESERVATION_PAGE_SIZE } from "./reservation.constants";
import type { ReservationFilters, ReservationListItem } from "./reservation.types";

export async function listReservations(filters: ReservationFilters): Promise<{ items: ReservationListItem[]; totalCount: number; totalPages: number }> {
  const where = { propertyId: filters.propertyId, roomId: filters.roomId, provider: filters.provider, status: filters.status, startDate: { lt: filters.toExclusive }, endDate: { gt: filters.from } };
  const [rows, totalCount] = await Promise.all([prisma.reservation.findMany({ where, select: { id: true, guestName: true, startDate: true, endDate: true, provider: true, status: true, property: { select: { name: true } }, room: { select: { name: true } } }, orderBy: [{ startDate: "asc" }, { room: { name: "asc" } }], skip: (filters.page - 1) * RESERVATION_PAGE_SIZE, take: RESERVATION_PAGE_SIZE }), prisma.reservation.count({ where })]);
  return { items: rows.map(({ property, room, ...reservation }) => ({ ...reservation, propertyName: property.name, roomName: room.name })), totalCount, totalPages: Math.max(1, Math.ceil(totalCount / RESERVATION_PAGE_SIZE)) };
}
