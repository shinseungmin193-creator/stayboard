import "server-only";

import { prisma } from "@/lib/prisma";
import type { RoomStatusRoom } from "./room-status.types";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import { buildRoomStatusReservationWhere } from "./room-status-calendar";
import { getReservationConflictPeers, isCurrentReservationConflict } from "@/features/reservation-conflicts/domain/reservation-conflict";

export async function listRoomStatusCalendar(input: {
  propertyId?: string;
  rangeStart: Date;
  rangeEnd: Date;
  companyIds?: readonly string[];
  accessScope?: AccessScope;
}): Promise<RoomStatusRoom[]> {
  const rooms = await prisma.room.findMany({
    where: {
      ...(roomScopeWhere(input.accessScope) ?? {}),
      isActive: true,
      property: { isActive: true, company: { isActive: true }, companyId: input.companyIds ? { in: [...input.companyIds] } : undefined },
      propertyId: input.propertyId,
    },
    select: {
      id: true,
      name: true,
      propertyId: true,
      property: { select: { name: true } },
      calendarSources: {
        where: { isActive: true, provider: { in: [...CALENDAR_PROVIDER_TYPES] } },
        select: { id: true, name: true, provider: true },
        orderBy: [{ provider: "asc" }, { name: "asc" }],
      },
      conflicts: {
        where: {
          status: "ACTIVE",
          overlapStart: { lt: input.rangeEnd },
          overlapEnd: { gt: input.rangeStart },
          reservationA: buildOperationalReservationWhere(),
          reservationB: buildOperationalReservationWhere(),
        },
        select: {
          id: true,
          reservationA: { select: { id: true, roomId: true, guestName: true, provider: true, status: true, startDate: true, endDate: true } },
          reservationB: { select: { id: true, roomId: true, guestName: true, provider: true, status: true, startDate: true, endDate: true } },
        },
      },
      reservations: {
        where: buildRoomStatusReservationWhere(input),
        select: {
          id: true,
          providerReservationId: true,
          guestName: true,
          summary: true,
          startDate: true,
          endDate: true,
          provider: true,
          status: true,
          calendarSource: { select: { name: true } },
        },
        orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
      },
    },
    orderBy: [
      { property: { name: "asc" } },
      { sortOrder: "asc" },
      { code: "asc" },
      { name: "asc" },
    ],
  });

  return rooms.map(({ property, calendarSources, conflicts, reservations, ...room }) => {
    const actualConflicts = conflicts.filter(isCurrentReservationConflict);
    return {
      ...room,
      name: formatRoomDisplayName(room),
      propertyName: property.name,
      sources: calendarSources,
      reservations: reservations.map(({ calendarSource, ...reservation }) => {
        const activeConflicts = getReservationConflictPeers(reservation.id, actualConflicts);
        return {
          ...reservation,
          calendarSourceName: calendarSource.name,
          activeConflicts,
        };
      }),
    };
  });
}
