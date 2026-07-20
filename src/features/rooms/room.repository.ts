import "server-only";
import { prisma } from "@/lib/prisma";
import type { RoomListItem } from "./room.types";

export async function listRooms(propertyId?: string): Promise<RoomListItem[]> {
  const rooms = await prisma.room.findMany({
    where: propertyId ? { propertyId } : undefined,
    select: { id: true, propertyId: true, name: true, code: true, capacity: true, sortOrder: true, isActive: true, property: { select: { name: true, isActive: true } }, _count: { select: { calendarSources: true } } },
    orderBy: [{ isActive: "desc" }, { property: { name: "asc" } }, { sortOrder: "asc" }, { code: "asc" }, { name: "asc" }],
  });
  return rooms.map(({ property, _count, ...room }) => ({ ...room, propertyName: property.name, propertyIsActive: property.isActive, calendarSourceCount: _count.calendarSources }));
}
export function createRoom(data: { propertyId: string; name: string; code: string; capacity: number; sortOrder: number }) { return prisma.room.create({ data, select: { id: true } }); }
export function updateRoom(id: string, data: { propertyId: string; name: string; code: string; capacity: number; sortOrder: number }) { return prisma.room.update({ where: { id }, data, select: { id: true } }); }
export function roomExists(id: string) { return prisma.room.findUnique({ where: { id }, select: { id: true, isActive: true } }); }
export function setRoomActive(id: string, isActive: boolean) { return prisma.room.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
