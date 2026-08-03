-- The previous preference stored dashboard card IDs, which cannot be safely
-- converted to bottom-navigation menu IDs. Drop it without migrating values.
DROP TABLE "DashboardRolePreference";

DROP TYPE "DashboardViewport";

-- CreateTable
CREATE TABLE "MobileNavigationPreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL,
    "itemOrder" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileNavigationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileNavigationPreference_companyId_role_key" ON "MobileNavigationPreference"("companyId", "role");

-- CreateIndex
CREATE INDEX "MobileNavigationPreference_companyId_idx" ON "MobileNavigationPreference"("companyId");

-- AddForeignKey
ALTER TABLE "MobileNavigationPreference" ADD CONSTRAINT "MobileNavigationPreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
