-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReservationStatus" ADD VALUE 'TENTATIVE';
ALTER TYPE "ReservationStatus" ADD VALUE 'UNKNOWN';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "description" TEXT,
ADD COLUMN     "providerCreatedAt" TIMESTAMP(3),
ADD COLUMN     "providerUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "summary" TEXT;

-- CreateIndex
CREATE INDEX "Reservation_provider_startDate_idx" ON "Reservation"("provider", "startDate");
