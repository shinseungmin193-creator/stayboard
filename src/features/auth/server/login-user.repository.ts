import "server-only";

import { prisma } from "@/lib/prisma";
import type { LoginUserRecord } from "../domain/authenticate-login";
import { normalizeLoginIdentifier } from "../domain/identity";

const loginUserSelect = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  isActive: true,
  systemRole: true,
  memberships: {
    select: {
      status: true,
      company: { select: { isActive: true } },
    },
  },
} as const;

export async function findLoginUserByIdentifier(identifier: string): Promise<LoginUserRecord | null> {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedIdentifier, mode: "insensitive" } },
        { username: { equals: normalizedIdentifier, mode: "insensitive" } },
      ],
    },
    select: loginUserSelect,
  });
  if (!user) return null;
  return {
    ...user,
    memberships: user.memberships.map((membership) => ({
      status: membership.status,
      companyActive: membership.company.isActive,
    })),
  };
}
