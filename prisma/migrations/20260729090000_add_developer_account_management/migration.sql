CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

ALTER TABLE "User"
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedById" TEXT,
ADD COLUMN "suspensionReason" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletionReason" TEXT,
ADD COLUMN "anonymizedAt" TIMESTAMP(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

UPDATE "User"
SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"UserStatus" ELSE 'SUSPENDED'::"UserStatus" END;

ALTER TABLE "Company"
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedById" TEXT,
ADD COLUMN "suspensionReason" TEXT;

UPDATE "Company"
SET "suspendedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP),
    "suspensionReason" = '기존 비활성 상태 마이그레이션'
WHERE NOT "isActive";

ALTER TABLE "AuditLog"
ADD COLUMN "targetCompanyId" TEXT,
ADD COLUMN "reason" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_suspendedById_fkey"
FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
ADD CONSTRAINT "User_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Company"
ADD CONSTRAINT "Company_suspendedById_fkey"
FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_targetCompanyId_fkey"
FOREIGN KEY ("targetCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");
CREATE INDEX "User_suspendedById_idx" ON "User"("suspendedById");
CREATE INDEX "User_deletedById_idx" ON "User"("deletedById");
CREATE INDEX "Company_suspendedById_idx" ON "Company"("suspendedById");
CREATE INDEX "AuditLog_targetCompanyId_createdAt_idx" ON "AuditLog"("targetCompanyId", "createdAt");
