-- CreateEnum
CREATE TYPE "DashboardViewport" AS ENUM ('MOBILE', 'DESKTOP');

-- CreateTable
CREATE TABLE "DashboardRolePreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL,
    "viewport" "DashboardViewport" NOT NULL,
    "cardOrder" JSONB NOT NULL,
    "hiddenCardIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardRolePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardRolePreference_companyId_role_viewport_key" ON "DashboardRolePreference"("companyId", "role", "viewport");

-- CreateIndex
CREATE INDEX "DashboardRolePreference_companyId_idx" ON "DashboardRolePreference"("companyId");

-- AddForeignKey
ALTER TABLE "DashboardRolePreference" ADD CONSTRAINT "DashboardRolePreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
