import "server-only";
import { prisma } from "@/lib/prisma";

export function listInvitationCodes(companyId: string) {
  return prisma.invitationCode.findMany({
    where: { companyId, role: "ADMIN" },
    select: { id: true, codePrefix: true, status: true, createdAt: true, usedAt: true, revokedAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}
