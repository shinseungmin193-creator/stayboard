CREATE TYPE "InvitationCodeStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED');

ALTER TABLE "InvitationCode"
ADD COLUMN "status" "InvitationCodeStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "usedAt" TIMESTAMP(3),
ADD COLUMN "usedById" TEXT,
ADD COLUMN "revokedAt" TIMESTAMP(3);

UPDATE "InvitationCode"
SET
  "status" = CASE
    WHEN "usedCount" > 0 THEN 'USED'::"InvitationCodeStatus"
    WHEN "isActive" = false THEN 'REVOKED'::"InvitationCodeStatus"
    ELSE 'ACTIVE'::"InvitationCodeStatus"
  END,
  "usedAt" = CASE WHEN "usedCount" > 0 THEN "updatedAt" ELSE NULL END,
  "revokedAt" = CASE WHEN "usedCount" = 0 AND "isActive" = false THEN "updatedAt" ELSE NULL END;

UPDATE "InvitationCode"
SET "status" = 'REVOKED', "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP)
WHERE "role" <> 'ADMIN' OR "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt" DESC, "id" DESC) AS position
    FROM "InvitationCode"
    WHERE "status" = 'ACTIVE' AND "role" = 'ADMIN'
  ) ranked
  WHERE ranked.position > 1
);

UPDATE "InvitationCode" SET "role" = 'ADMIN' WHERE "role" <> 'ADMIN';
ALTER TABLE "InvitationCode" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_admin_role_check" CHECK ("role" = 'ADMIN');

DROP INDEX IF EXISTS "InvitationCode_companyId_role_isActive_idx";
DROP INDEX IF EXISTS "InvitationCode_expiresAt_idx";
ALTER TABLE "InvitationCode" DROP CONSTRAINT IF EXISTS "InvitationCode_usage_check";
ALTER TABLE "InvitationCode" DROP CONSTRAINT IF EXISTS "InvitationCode_used_count_check";

ALTER TABLE "InvitationCode"
DROP COLUMN "isActive",
DROP COLUMN "expiresAt",
DROP COLUMN "maxUses",
DROP COLUMN "usedCount";

CREATE INDEX "InvitationCode_companyId_status_createdAt_idx" ON "InvitationCode"("companyId", "status", "createdAt");
CREATE INDEX "InvitationCode_usedById_idx" ON "InvitationCode"("usedById");
CREATE UNIQUE INDEX "InvitationCode_one_active_per_company_key" ON "InvitationCode"("companyId") WHERE "status" = 'ACTIVE';

ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_usedById_fkey"
FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
