-- A client-generated upload id makes mobile retries idempotent. Existing
-- photos remain valid because PostgreSQL permits multiple NULL values here.
ALTER TABLE "CleaningPhoto" ADD COLUMN "clientUploadId" TEXT;

CREATE UNIQUE INDEX "CleaningPhoto_taskId_clientUploadId_key"
ON "CleaningPhoto"("taskId", "clientUploadId");
