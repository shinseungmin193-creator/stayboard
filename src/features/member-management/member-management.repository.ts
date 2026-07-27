import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MEMBER_PAGE_SIZE } from "./member-management.constants";

export async function listCompanyMembers(input: { companyId: string; page: number; query: string; filter: "ALL" | "ADMIN" | "STAFF" | "DISABLED" }) {
  const where: Prisma.CompanyMembershipWhereInput = {
    companyId: input.companyId,
    status: input.filter === "DISABLED"
      ? "DISABLED" as const
      : { in: ["ACTIVE", "DISABLED"] },
    ...(input.query ? { OR: [{ user: { name: { contains: input.query, mode: "insensitive" as const } } }, { user: { email: { contains: input.query, mode: "insensitive" as const } } }] } : {}),
    ...(input.filter === "ADMIN" || input.filter === "STAFF" ? { role: input.filter } : {}),
  };
  const totalCount = await prisma.companyMembership.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / MEMBER_PAGE_SIZE)); const page = Math.min(input.page, totalPages);
  const memberships = await prisma.companyMembership.findMany({ where, select: { id: true, role: true, status: true, createdAt: true, user: { select: { id: true, name: true, email: true, lastLoginAt: true } }, propertyAccesses: { select: { propertyId: true, property: { select: { name: true } } } } }, orderBy: [{ status: "asc" }, { user: { name: "asc" } }], skip: (page - 1) * MEMBER_PAGE_SIZE, take: MEMBER_PAGE_SIZE });
  return { rows: memberships.map((membership) => ({ kind: "MEMBER" as const, membership })), totalCount, totalPages, page };
}
export function listCompanyProperties(companyId: string) { return prisma.property.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }); }
