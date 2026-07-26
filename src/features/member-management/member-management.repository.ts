import "server-only";

import { prisma } from "@/lib/prisma";
import { MEMBER_PAGE_SIZE } from "./member-management.constants";

export async function listCompanyMembers(input: { companyId: string; page: number; query: string; filter: "ALL" | "ADMIN" | "STAFF" | "INVITED" | "DISABLED" }) {
  const search = input.query ? { OR: [{ user: { name: { contains: input.query, mode: "insensitive" as const } } }, { user: { email: { contains: input.query, mode: "insensitive" as const } } }] } : {};
  const membershipWhere = { companyId: input.companyId, ...search, ...(input.filter === "ADMIN" || input.filter === "STAFF" ? { role: input.filter } : {}), ...(input.filter === "DISABLED" ? { status: "DISABLED" as const } : input.filter === "INVITED" ? { id: "__none__" } : {}) };
  const invitationWhere = { companyId: input.companyId, acceptedAt: null, cancelledAt: null, ...(input.query ? { OR: [{ email: { contains: input.query, mode: "insensitive" as const } }, { displayName: { contains: input.query, mode: "insensitive" as const } }] } : {}), ...(input.filter === "ADMIN" || input.filter === "STAFF" ? { role: input.filter } : {}), ...(input.filter === "DISABLED" ? { id: "__none__" } : {}) };
  const includeMembers = input.filter !== "INVITED";
  const includeInvitations = input.filter === "ALL" || input.filter === "INVITED" || input.filter === "ADMIN" || input.filter === "STAFF";
  const [memberCount, invitationCount] = await Promise.all([
    includeMembers ? prisma.companyMembership.count({ where: membershipWhere }) : 0,
    includeInvitations ? prisma.companyInvitation.count({ where: invitationWhere }) : 0,
  ]);
  const totalCount = memberCount + invitationCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / MEMBER_PAGE_SIZE));
  const page = Math.min(input.page, totalPages);
  const offset = (page - 1) * MEMBER_PAGE_SIZE;
  const memberTake = Math.max(0, Math.min(MEMBER_PAGE_SIZE, memberCount - offset));
  const invitationSkip = Math.max(0, offset - memberCount);
  const invitationTake = MEMBER_PAGE_SIZE - memberTake;
  const [members, invitations] = await Promise.all([
    memberTake > 0 ? prisma.companyMembership.findMany({ where: membershipWhere, select: { id: true, role: true, status: true, createdAt: true, user: { select: { id: true, name: true, email: true, lastLoginAt: true } }, propertyAccesses: { select: { propertyId: true, property: { select: { name: true } } } } }, orderBy: [{ status: "asc" }, { user: { name: "asc" } }], skip: offset, take: memberTake }) : [],
    invitationTake > 0 && includeInvitations ? prisma.companyInvitation.findMany({ where: invitationWhere, select: { id: true, email: true, displayName: true, role: true, propertyIds: true, expiresAt: true, createdAt: true, mailStatus: true, invitedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: invitationSkip, take: invitationTake }) : [],
  ]);
  const rows = [
    ...members.map((membership) => ({ kind: "MEMBER" as const, membership })),
    ...invitations.map((invitation) => ({ kind: "INVITATION" as const, invitation })),
  ];
  return { rows, totalCount, totalPages, page };
}

export function listCompanyProperties(companyId: string) {
  return prisma.property.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
