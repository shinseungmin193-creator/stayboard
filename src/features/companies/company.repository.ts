import "server-only";
import { prisma } from "@/lib/prisma";
import type { CompanyListItem, CompanyOption } from "./company.types";

export async function listCompanyOptions(): Promise<CompanyOption[]> {
  return prisma.company.findMany({ select: { id: true, name: true, isActive: true }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export async function listCompanies(): Promise<CompanyListItem[]> {
  const companies = await prisma.company.findMany({ select: { id: true, name: true, isActive: true, _count: { select: { properties: true } } }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return companies.map(({ _count, ...company }) => ({ ...company, propertyCount: _count.properties }));
}

export function createCompany(name: string) { return prisma.company.create({ data: { name }, select: { id: true } }); }
export function updateCompany(id: string, name: string) { return prisma.company.update({ where: { id }, data: { name }, select: { id: true } }); }
export function findCompany(id: string) { return prisma.company.findUnique({ where: { id }, select: { id: true, isActive: true } }); }
export function setCompanyActive(id: string, isActive: boolean) { return prisma.company.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
