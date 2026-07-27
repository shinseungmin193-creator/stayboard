-- All pending/failed email invitation records (including records without a
-- User or CompanyMembership) are intentionally retired. Existing users and
-- company memberships are not changed by this migration.
DROP TABLE IF EXISTS "CompanyInvitation";
DROP TYPE IF EXISTS "InvitationMailStatus";

CREATE TABLE "InvitationCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvitationCode_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvitationCode_usage_check" CHECK ("maxUses" IS NULL OR "maxUses" > 0),
    CONSTRAINT "InvitationCode_used_count_check" CHECK ("usedCount" >= 0)
);

CREATE UNIQUE INDEX "InvitationCode_codeHash_key" ON "InvitationCode"("codeHash");
CREATE INDEX "InvitationCode_companyId_role_isActive_idx" ON "InvitationCode"("companyId", "role", "isActive");
CREATE INDEX "InvitationCode_expiresAt_idx" ON "InvitationCode"("expiresAt");

ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
