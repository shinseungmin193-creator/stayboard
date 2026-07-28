import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const invitationCodeListSelect = {
  id: true,
  role: true,
  codePrefix: true,
  status: true,
  createdAt: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
} satisfies Prisma.InvitationCodeSelect;

export function listInvitationCodes(companyId: string) {
  return prisma.invitationCode.findMany({
    where: { companyId },
    select: invitationCodeListSelect,
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
