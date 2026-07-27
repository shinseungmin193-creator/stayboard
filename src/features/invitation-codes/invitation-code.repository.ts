import "server-only";
import { prisma } from "@/lib/prisma";
export function listInvitationCodes(companyId: string) {
  return prisma.invitationCode.findMany({ where: { companyId }, select: { id: true, role: true, codePrefix: true, isActive: true, expiresAt: true, maxUses: true, usedCount: true, createdAt: true }, orderBy: [{ role: "asc" }, { createdAt: "desc" }] });
}
