-- CreateEnum
CREATE TYPE "RoomOperationalStatus" AS ENUM ('NONE', 'CLEANING_REQUIRED', 'INSPECTION_REQUIRED');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "operationalStatus" "RoomOperationalStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "operationalStatusUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Room_operationalStatus_isActive_idx" ON "Room"("operationalStatus", "isActive");
