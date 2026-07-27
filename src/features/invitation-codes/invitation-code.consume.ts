import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";
export async function consumeInvitationCode(tx: Prisma.TransactionClient, id: string, now = new Date()) {
  const rows = await tx.$queryRaw<Array<{ id: string; companyId: string; role: CompanyMemberRole; usedCount: number; maxUses: number | null }>>(Prisma.sql`
    UPDATE "InvitationCode" SET "usedCount" = "usedCount" + 1,
      "isActive" = CASE WHEN "maxUses" IS NOT NULL AND "usedCount" + 1 >= "maxUses" THEN false ELSE "isActive" END,
      "updatedAt" = NOW()
    WHERE "id" = ${id} AND "isActive" = true
      AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    RETURNING "id", "companyId", "role", "usedCount", "maxUses"
  `); return rows[0] ?? null;
}
