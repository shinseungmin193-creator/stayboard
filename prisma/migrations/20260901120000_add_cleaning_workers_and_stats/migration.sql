ALTER TABLE "CleaningTask"
ADD COLUMN "cleanerName" TEXT;

CREATE TABLE "CleaningWorker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleaningWorker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CleaningWorker_companyId_normalizedName_key"
ON "CleaningWorker"("companyId", "normalizedName");

CREATE INDEX "CleaningWorker_companyId_isActive_name_idx"
ON "CleaningWorker"("companyId", "isActive", "name");

CREATE INDEX "CleaningTask_companyId_status_cleanerName_completedAt_idx"
ON "CleaningTask"("companyId", "status", "cleanerName", "completedAt");

ALTER TABLE "CleaningWorker"
ADD CONSTRAINT "CleaningWorker_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing CleaningTask rows intentionally keep cleanerName NULL. Historical
-- records must not be backfilled from login-account snapshots.
