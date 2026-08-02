import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

export const findDeveloperRoleSessionByTokenHash = cache((tokenHash: string) => prisma.developerRoleSession.findUnique({
  where: { tokenHash },
  select: {
    id: true,
    tokenHash: true,
    developerUserId: true,
    previewRole: true,
    companyId: true,
    propertyScope: true,
    expiresAt: true,
    revokedAt: true,
    createdAt: true,
    developer: { select: { id: true, systemRole: true, status: true, isActive: true } },
    company: {
      select: {
        id: true,
        name: true,
        isActive: true,
        properties: {
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    },
  },
}));

export const listDeveloperRoleSwitchCompanies = cache(() => prisma.company.findMany({
  where: { isActive: true },
  select: {
    id: true,
    name: true,
    properties: {
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    },
  },
  orderBy: { name: "asc" },
}));
