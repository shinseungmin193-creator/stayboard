import "server-only";
import { prisma } from "@/lib/prisma";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import type { CalendarRoomOption, CalendarSourceFilters } from "./calendar-source.types";

export function listCalendarSources(filters: CalendarSourceFilters) {
  return prisma.calendarSource.findMany({
    where: { roomId: filters.roomId, provider: filters.provider, isActive: filters.isActive, room: filters.propertyId ? { propertyId: filters.propertyId } : undefined },
    select: { id: true, roomId: true, provider: true, name: true, calendarUrl: true, isActive: true, lastSyncedAt: true, room: { select: { name: true, propertyId: true, property: { select: { name: true } } } } },
    orderBy: [{ isActive: "desc" }, { room: { property: { name: "asc" } } }, { room: { name: "asc" } }, { provider: "asc" }, { name: "asc" }],
  });
}
export async function listCalendarRoomOptions(): Promise<CalendarRoomOption[]> { const rooms = await prisma.room.findMany({ select: { id: true, name: true, propertyId: true, isActive: true, property: { select: { name: true, isActive: true } } }, orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] }); return rooms.map(({ property, ...room }) => ({ ...room, propertyName: property.name, propertyIsActive: property.isActive })); }
export function findCalendarSource(id: string) { return prisma.calendarSource.findUnique({ where: { id }, select: { id: true, roomId: true, provider: true, name: true, calendarUrl: true, isActive: true } }); }
export function findCalendarRoom(id: string) { return prisma.room.findUnique({ where: { id }, select: { id: true, propertyId: true, property: { select: { id: true } } } }); }
export function findDuplicateCalendarUrl(roomId: string, calendarUrl: string, excludeId?: string) { return prisma.calendarSource.findFirst({ where: { roomId, calendarUrl, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } }); }
export function createCalendarSource(data: { roomId: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean }) { return prisma.calendarSource.create({ data, select: { id: true } }); }
export function updateCalendarSource(id: string, data: { roomId: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean }) { return prisma.calendarSource.update({ where: { id }, data, select: { id: true } }); }
export function setCalendarSourceActive(id: string, isActive: boolean) { return prisma.calendarSource.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
