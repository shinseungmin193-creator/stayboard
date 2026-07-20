import "server-only";
import { prisma } from "@/lib/prisma";
import type { PropertyListItem, PropertyOption } from "./property.types";

export async function listProperties(): Promise<PropertyListItem[]> {
  const properties = await prisma.property.findMany({
    select: { id: true, companyId: true, name: true, address: true, timezone: true, isActive: true, company: { select: { name: true } }, rooms: { select: { isActive: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return properties.map(({ company, rooms, ...property }) => ({ ...property, companyName: company.name, totalRooms: rooms.length, activeRooms: rooms.filter((room) => room.isActive).length }));
}

export async function listPropertyOptions(): Promise<PropertyOption[]> {
  return prisma.property.findMany({ select: { id: true, name: true, isActive: true }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export function createProperty(data: { companyId: string; name: string; address: string; timezone: string }) { return prisma.property.create({ data, select: { id: true } }); }
export function updateProperty(id: string, data: { companyId: string; name: string; address: string; timezone: string }) { return prisma.property.update({ where: { id }, data, select: { id: true } }); }
export function setPropertyActive(id: string, isActive: boolean) { return prisma.property.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
export function propertyExists(id: string) { return prisma.property.findUnique({ where: { id }, select: { id: true, isActive: true } }); }
