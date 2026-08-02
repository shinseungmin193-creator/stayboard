-- CreateTable
CREATE TABLE "DeveloperRoleSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "developerUserId" TEXT NOT NULL,
    "previewRole" "CompanyMemberRole" NOT NULL,
    "companyId" TEXT NOT NULL,
    "propertyScope" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperRoleSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperRoleSession_tokenHash_key" ON "DeveloperRoleSession"("tokenHash");

-- CreateIndex
CREATE INDEX "DeveloperRoleSession_developerUserId_expiresAt_idx" ON "DeveloperRoleSession"("developerUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "DeveloperRoleSession_companyId_expiresAt_idx" ON "DeveloperRoleSession"("companyId", "expiresAt");

-- CreateIndex
CREATE INDEX "DeveloperRoleSession_revokedAt_expiresAt_idx" ON "DeveloperRoleSession"("revokedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "DeveloperRoleSession" ADD CONSTRAINT "DeveloperRoleSession_developerUserId_fkey" FOREIGN KEY ("developerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperRoleSession" ADD CONSTRAINT "DeveloperRoleSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
