import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";

export async function consumeInvitationCode(tx: Prisma.TransactionClient, id: string, userId: string, usedAt = new Date()) {
  const rows = await tx.$queryRaw<Array<{ id: string; companyId: string; role: CompanyMemberRole }>>(Prisma.sql`
    UPDATE "InvitationCode"
    SET "status" = 'USED', "usedAt" = ${usedAt}, "usedById" = ${userId}, "updatedAt" = NOW()
    WHERE "id" = ${id}
      AND "status" = 'ACTIVE'
      AND "usedAt" IS NULL
      AND "expiresAt" > ${usedAt}
    RETURNING "id", "companyId", "role"
  `);
  return rows[0] ?? null;
}
