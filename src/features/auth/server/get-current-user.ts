import "server-only";

import { cache } from "react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../auth.config";

export const getOptionalSession = cache(() => getServerSession(authOptions));

export const getCurrentUser = cache(async () => {
  const session = await getOptionalSession();
  if (!session?.user.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      isActive: true,
      memberships: {
        where: { company: { isActive: true } },
        select: { companyId: true, role: true, company: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      assignments: {
        select: {
          propertyId: true,
          roomId: true,
          property: { select: { companyId: true } },
          room: { select: { property: { select: { companyId: true } } } },
        },
      },
    },
  });
});
