import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DeveloperCompanyListItem,
  DeveloperMembershipDetail,
  DeveloperUserListItem,
} from "./developer-management.types";

export const DEVELOPER_MANAGEMENT_PAGE_SIZE = 20;

function inclusiveEndDate(value?: string) {
  if (!value) return undefined;
  const result = new Date(`${value}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

export async function listDeveloperUsers(input: {
  query: string;
  status: "CURRENT" | "ACTIVE" | "SUSPENDED" | "DELETED";
  role: "ALL" | "DEVELOPER" | "ADMIN" | "STAFF";
  createdFrom?: string;
  createdTo?: string;
  sort: "NEWEST" | "OLDEST" | "LAST_LOGIN" | "NAME";
  page: number;
}) {
  const where: Prisma.UserWhereInput = {
    status: input.status === "CURRENT" ? { not: "DELETED" } : input.status,
    ...(input.query
      ? {
          OR: [
            { name: { contains: input.query, mode: "insensitive" as const } },
            { email: { contains: input.query, mode: "insensitive" as const } },
            { username: { contains: input.query, mode: "insensitive" as const } },
            { memberships: { some: { company: { name: { contains: input.query, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
    ...(input.role === "DEVELOPER"
      ? { systemRole: "DEVELOPER" as const }
      : input.role === "ADMIN" || input.role === "STAFF"
        ? { systemRole: "NONE" as const, memberships: { some: { role: input.role } } }
        : {}),
    ...(input.createdFrom || input.createdTo
      ? {
          createdAt: {
            ...(input.createdFrom ? { gte: new Date(`${input.createdFrom}T00:00:00.000Z`) } : {}),
            ...(input.createdTo ? { lt: inclusiveEndDate(input.createdTo) } : {}),
          },
        }
      : {}),
  };
  const totalCount = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / DEVELOPER_MANAGEMENT_PAGE_SIZE));
  const page = Math.min(input.page, totalPages);
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    input.sort === "OLDEST"
      ? [{ createdAt: "asc" }]
      : input.sort === "LAST_LOGIN"
        ? [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        : input.sort === "NAME"
          ? [{ name: "asc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }];
  const rows = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      systemRole: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      memberships: {
        where: { status: { in: ["ACTIVE", "DISABLED"] } },
        select: { role: true, company: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy,
    skip: (page - 1) * DEVELOPER_MANAGEMENT_PAGE_SIZE,
    take: DEVELOPER_MANAGEMENT_PAGE_SIZE,
  });
  const items: DeveloperUserListItem[] = rows.map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    systemRole: user.systemRole,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    companyNames: user.memberships.map((membership) => membership.company.name),
    companyRoles: [...new Set(user.memberships.map((membership) => membership.role))],
  }));
  return { items, totalCount, totalPages, page };
}

export async function getDeveloperUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      systemRole: true,
      isActive: true,
      status: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      suspendedAt: true,
      suspensionReason: true,
      suspendedBy: { select: { id: true, name: true } },
      deletedAt: true,
      deletionReason: true,
      deletedBy: { select: { id: true, name: true } },
      anonymizedAt: true,
      memberships: {
        select: {
          id: true,
          companyId: true,
          role: true,
          status: true,
          company: { select: { id: true, name: true, isActive: true } },
          propertyAccesses: { select: { propertyId: true } },
          _count: { select: { propertyAccesses: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      assignments: { select: { propertyId: true, roomId: true } },
      invitationCodesUsed: {
        select: { createdBy: { select: { id: true, name: true } } },
        orderBy: { usedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!user) return null;
  const companyIds = user.memberships.map((membership) => membership.companyId);
  const adminCompanyIds = user.memberships.filter((membership) => membership.role === "ADMIN" && membership.status === "ACTIVE").map((membership) => membership.companyId);
  const [candidates, adminProperties] = await Promise.all([
    companyIds.length ? prisma.companyMembership.findMany({
        where: {
          companyId: { in: companyIds },
          userId: { not: user.id },
          role: "STAFF",
          status: "ACTIVE",
          user: { status: "ACTIVE", isActive: true },
        },
        select: { companyId: true, user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      }) : [],
    adminCompanyIds.length ? prisma.property.findMany({
      where: { companyId: { in: adminCompanyIds } },
      select: { id: true, rooms: { select: { id: true } } },
    }) : [],
  ]);
  const memberships: DeveloperMembershipDetail[] = user.memberships.map((membership) => ({
    id: membership.id,
    companyId: membership.companyId,
    companyName: membership.company.name,
    companyActive: membership.company.isActive,
    role: membership.role,
    status: membership.status,
    propertyAccessCount: membership._count.propertyAccesses,
    replacementCandidates: candidates
      .filter((candidate) => candidate.companyId === membership.companyId)
      .map((candidate) => candidate.user),
  }));
  return {
    ...user,
    memberships,
    propertyAssignmentCount: new Set([
      ...adminProperties.map((property) => property.id),
      ...user.memberships.flatMap((membership) => membership.propertyAccesses.map((access) => access.propertyId)),
      ...user.assignments.flatMap((assignment) => assignment.propertyId ? [assignment.propertyId] : []),
    ]).size,
    roomAssignmentCount: new Set([
      ...adminProperties.flatMap((property) => property.rooms.map((room) => room.id)),
      ...user.assignments.flatMap((assignment) => assignment.roomId ? [assignment.roomId] : []),
    ]).size,
    invitedBy: user.invitationCodesUsed[0]?.createdBy ?? null,
  };
}

export async function listDeveloperCompanies(input: {
  query: string;
  status: "ALL" | "ACTIVE" | "SUSPENDED" | "NO_ADMIN";
  sort: "NEWEST" | "OLDEST" | "NAME" | "RECENT_ACTIVITY";
  page: number;
}) {
  const activeAdmin = {
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    user: { status: "ACTIVE" as const, isActive: true },
  };
  const where: Prisma.CompanyWhereInput = {
    ...(input.query
      ? {
          OR: [
            { name: { contains: input.query, mode: "insensitive" as const } },
            { memberships: { some: { role: "ADMIN" as const, user: { name: { contains: input.query, mode: "insensitive" as const } } } } },
            { memberships: { some: { role: "ADMIN" as const, user: { email: { contains: input.query, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
    ...(input.status === "ACTIVE"
      ? { isActive: true }
      : input.status === "SUSPENDED"
        ? { isActive: false }
        : input.status === "NO_ADMIN"
          ? { memberships: { none: activeAdmin } }
          : {}),
  };
  const totalCount = await prisma.company.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / DEVELOPER_MANAGEMENT_PAGE_SIZE));
  const page = Math.min(input.page, totalPages);
  const orderBy: Prisma.CompanyOrderByWithRelationInput[] =
    input.sort === "OLDEST"
      ? [{ createdAt: "asc" }]
      : input.sort === "NAME"
        ? [{ name: "asc" }]
        : input.sort === "RECENT_ACTIVITY"
          ? [{ updatedAt: "desc" }]
          : [{ createdAt: "desc" }];
  const companies = await prisma.company.findMany({
    where,
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        where: { status: "ACTIVE", user: { status: "ACTIVE", isActive: true } },
        select: { role: true },
      },
      properties: { select: { id: true, _count: { select: { rooms: true } } } },
    },
    orderBy,
    skip: (page - 1) * DEVELOPER_MANAGEMENT_PAGE_SIZE,
    take: DEVELOPER_MANAGEMENT_PAGE_SIZE,
  });
  const items: DeveloperCompanyListItem[] = companies.map((company) => ({
    id: company.id,
    name: company.name,
    isActive: company.isActive,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    adminCount: company.memberships.filter((membership) => membership.role === "ADMIN").length,
    staffCount: company.memberships.filter((membership) => membership.role === "STAFF").length,
    propertyCount: company.properties.length,
    roomCount: company.properties.reduce((total, property) => total + property._count.rooms, 0),
  }));
  return { items, totalCount, totalPages, page };
}

export async function getDeveloperCompanyDetail(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      suspendedAt: true,
      suspensionReason: true,
      suspendedBy: { select: { id: true, name: true } },
      memberships: {
        where: { status: { in: ["ACTIVE", "DISABLED"] } },
        select: {
          id: true,
          role: true,
          status: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } },
        },
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
      },
      properties: { select: { id: true, _count: { select: { rooms: true } } } },
    },
  });
  if (!company) return null;
  return {
    ...company,
    propertyCount: company.properties.length,
    roomCount: company.properties.reduce((total, property) => total + property._count.rooms, 0),
    adminCount: company.memberships.filter((membership) => membership.role === "ADMIN" && membership.status === "ACTIVE" && membership.user.status === "ACTIVE").length,
    staffCount: company.memberships.filter((membership) => membership.role === "STAFF" && membership.status === "ACTIVE" && membership.user.status === "ACTIVE").length,
    adminCandidates: company.memberships
      .filter((membership) => membership.role === "STAFF" && membership.status === "ACTIVE" && membership.user.status === "ACTIVE")
      .map((membership) => membership.user),
  };
}

export async function listDeveloperAuditLogs(input: {
  actor: string;
  target: string;
  company: string;
  targetUserId?: string;
  targetCompanyId?: string;
  action: string;
  createdFrom?: string;
  createdTo?: string;
  page: number;
}) {
  const where: Prisma.AuditLogWhereInput = {
    ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}),
    ...(input.targetCompanyId ? { targetCompanyId: input.targetCompanyId } : {}),
    ...(input.actor
      ? { actor: { OR: [{ name: { contains: input.actor, mode: "insensitive" } }, { email: { contains: input.actor, mode: "insensitive" } }] } }
      : {}),
    ...(input.target
      ? { target: { OR: [{ name: { contains: input.target, mode: "insensitive" } }, { email: { contains: input.target, mode: "insensitive" } }] } }
      : {}),
    ...(input.company ? { targetCompany: { name: { contains: input.company, mode: "insensitive" } } } : {}),
    ...(input.action ? { action: input.action } : {}),
    ...(input.createdFrom || input.createdTo
      ? {
          createdAt: {
            ...(input.createdFrom ? { gte: new Date(`${input.createdFrom}T00:00:00.000Z`) } : {}),
            ...(input.createdTo ? { lt: inclusiveEndDate(input.createdTo) } : {}),
          },
        }
      : {}),
  };
  const totalCount = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / DEVELOPER_MANAGEMENT_PAGE_SIZE));
  const page = Math.min(input.page, totalPages);
  const items = await prisma.auditLog.findMany({
    where,
    select: {
      id: true,
      action: true,
      reason: true,
      details: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
      target: { select: { id: true, name: true } },
      targetCompany: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * DEVELOPER_MANAGEMENT_PAGE_SIZE,
    take: DEVELOPER_MANAGEMENT_PAGE_SIZE,
  });
  const actions = await prisma.auditLog.findMany({
    where: { action: { startsWith: "USER_" } },
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
  });
  const companyActions = await prisma.auditLog.findMany({
    where: { action: { startsWith: "COMPANY_" } },
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
  });
  return {
    items,
    actions: [...new Set([...actions, ...companyActions].map((item) => item.action))].sort(),
    totalCount,
    totalPages,
    page,
  };
}
