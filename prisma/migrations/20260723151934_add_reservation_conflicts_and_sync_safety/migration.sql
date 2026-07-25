-- CreateEnum
CREATE TYPE "ReservationConflictStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- AlterEnum
ALTER TYPE "SyncStatus" ADD VALUE 'TIMEOUT';

-- CreateTable
CREATE TABLE "ReservationConflict" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reservationAId" TEXT NOT NULL,
    "reservationBId" TEXT NOT NULL,
    "status" "ReservationConflictStatus" NOT NULL DEFAULT 'ACTIVE',
    "overlapStart" TIMESTAMP(3) NOT NULL,
    "overlapEnd" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationConflict_roomId_status_idx" ON "ReservationConflict"("roomId", "status");

-- CreateIndex
CREATE INDEX "ReservationConflict_reservationAId_status_idx" ON "ReservationConflict"("reservationAId", "status");

-- CreateIndex
CREATE INDEX "ReservationConflict_reservationBId_status_idx" ON "ReservationConflict"("reservationBId", "status");

-- CreateIndex
CREATE INDEX "ReservationConflict_status_overlapStart_overlapEnd_idx" ON "ReservationConflict"("status", "overlapStart", "overlapEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationConflict_reservationAId_reservationBId_key" ON "ReservationConflict"("reservationAId", "reservationBId");

-- AddForeignKey
ALTER TABLE "ReservationConflict" ADD CONSTRAINT "ReservationConflict_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationConflict" ADD CONSTRAINT "ReservationConflict_reservationAId_fkey" FOREIGN KEY ("reservationAId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationConflict" ADD CONSTRAINT "ReservationConflict_reservationBId_fkey" FOREIGN KEY ("reservationBId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
