import "server-only";

import { prisma } from "@/lib/prisma";
import type { AccessContext, UserRole } from "@/features/access-control";

export interface ManagedUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  companyIds: string[];
  companyNames: string[];
  propertyIds: string[];
  roomIds: string[];
}

export async function listManagedUsers(context: AccessContext, companyId?: string): Promise<ManagedUserSummary[]> {
  const effectiveCompanyId = context.role === "DEVELOPER" ? companyId : context.activeCompanyId ?? undefined;
  const users = await prisma.user.findMany({
    where: effectiveCompanyId
      ? context.role === "DEVELOPER"
        ? { OR: [{ systemRole: "DEVELOPER" }, { memberships: { some: { companyId: effectiveCompanyId } } }] }
        : { memberships: { some: { companyId: effectiveCompanyId } } }
      : undefined,
    select: {
      id: true, name: true, email: true, systemRole: true, isActive: true, lastLoginAt: true,
      memberships: { select: { companyId: true, role: true, company: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      assignments: { select: { propertyId: true, roomId: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.systemRole === "DEVELOPER" ? "DEVELOPER" : (user.memberships.find((item) => item.companyId === effectiveCompanyId)?.role ?? user.memberships[0]?.role ?? "STAFF"),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    companyIds: user.memberships.map((item) => item.companyId),
    companyNames: user.memberships.map((item) => item.company.name),
    propertyIds: user.assignments.flatMap((item) => item.propertyId ? [item.propertyId] : []),
    roomIds: user.assignments.flatMap((item) => item.roomId ? [item.roomId] : []),
  }));
}
