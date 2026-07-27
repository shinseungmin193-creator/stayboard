import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";

export async function consumeInvitationCode(tx: Prisma.TransactionClient, id: string, userId: string, usedAt = new Date()) {
  const rows = await tx.$queryRaw<Array<{ id: string; companyId: string }>>(Prisma.sql`
    UPDATE "InvitationCode"
    SET "status" = 'USED', "usedAt" = ${usedAt}, "usedById" = ${userId}, "updatedAt" = NOW()
    WHERE "id" = ${id} AND "status" = 'ACTIVE' AND "role" = 'ADMIN'
    RETURNING "id", "companyId"
  `);
  return rows[0] ?? null;
}
