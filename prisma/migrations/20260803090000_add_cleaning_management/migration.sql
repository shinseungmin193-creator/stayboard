-- CreateEnum
CREATE TYPE "CleaningTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CleaningTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reservationId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "CleaningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleaningTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningPhoto" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "storageKey" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAfter" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deleteError" TEXT,
    "deleteAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CleaningPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CleaningTask_reservationId_roomId_key" ON "CleaningTask"("reservationId", "roomId");
CREATE INDEX "CleaningTask_companyId_status_scheduledDate_idx" ON "CleaningTask"("companyId", "status", "scheduledDate");
CREATE INDEX "CleaningTask_companyId_status_completedAt_idx" ON "CleaningTask"("companyId", "status", "completedAt");
CREATE INDEX "CleaningTask_propertyId_status_scheduledDate_idx" ON "CleaningTask"("propertyId", "status", "scheduledDate");
CREATE INDEX "CleaningTask_propertyId_status_completedAt_idx" ON "CleaningTask"("propertyId", "status", "completedAt");
CREATE INDEX "CleaningTask_roomId_scheduledDate_idx" ON "CleaningTask"("roomId", "scheduledDate");
CREATE INDEX "CleaningTask_assignedToId_scheduledDate_status_idx" ON "CleaningTask"("assignedToId", "scheduledDate", "status");
CREATE INDEX "CleaningTask_status_scheduledDate_idx" ON "CleaningTask"("status", "scheduledDate");
CREATE UNIQUE INDEX "CleaningPhoto_storageKey_key" ON "CleaningPhoto"("storageKey");
CREATE INDEX "CleaningPhoto_taskId_createdAt_idx" ON "CleaningPhoto"("taskId", "createdAt");
CREATE INDEX "CleaningPhoto_deleteAfter_deletedAt_idx" ON "CleaningPhoto"("deleteAfter", "deletedAt");
CREATE INDEX "CleaningPhoto_uploadedById_createdAt_idx" ON "CleaningPhoto"("uploadedById", "createdAt");

-- AddForeignKey
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CleaningPhoto" ADD CONSTRAINT "CleaningPhoto_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CleaningTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CleaningPhoto" ADD CONSTRAINT "CleaningPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill active upcoming checkout tasks so deployment does not have to wait for the next OTA sync.
INSERT INTO "CleaningTask" (
    "id", "companyId", "propertyId", "roomId", "reservationId", "scheduledDate", "status", "createdAt", "updatedAt"
)
SELECT
    'cln_' || md5(reservation."id" || ':' || reservation."roomId"),
    property."companyId",
    reservation."propertyId",
    reservation."roomId",
    reservation."id",
    reservation."endDate",
    'PENDING'::"CleaningTaskStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Reservation" AS reservation
JOIN "Property" AS property ON property."id" = reservation."propertyId"
WHERE reservation."status" IN ('CONFIRMED', 'TENTATIVE')
  AND reservation."endDate" > (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo')
ON CONFLICT ("reservationId", "roomId") DO NOTHING;
