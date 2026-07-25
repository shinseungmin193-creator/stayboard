-- CreateEnum
CREATE TYPE "GuestFallbackMode" AS ENUM ('PROVIDER', 'GENERIC');

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "defaultCheckInTime" TEXT NOT NULL DEFAULT '15:00',
    "defaultCheckOutTime" TEXT NOT NULL DEFAULT '10:00',
    "nextReservationDisplayDays" INTEGER NOT NULL DEFAULT 7,
    "showFutureReservationsAsVacant" BOOLEAN NOT NULL DEFAULT true,
    "showBlockedAsRoomStatus" BOOLEAN NOT NULL DEFAULT false,
    "conflictDisplayLabel" TEXT NOT NULL DEFAULT '오버부킹',
    "guestFallbackMode" "GuestFallbackMode" NOT NULL DEFAULT 'PROVIDER',
    "showNextReservationOnVacant" BOOLEAN NOT NULL DEFAULT true,
    "cleaningStatusEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inspectionStatusEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoMarkCleaningRequired" BOOLEAN NOT NULL DEFAULT false,
    "showSyncFailureWarnings" BOOLEAN NOT NULL DEFAULT true,
    "showSyncSuccessMessage" BOOLEAN NOT NULL DEFAULT false,
    "recentSyncLogLimit" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE INDEX "CompanySettings_companyId_idx" ON "CompanySettings"("companyId");

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
