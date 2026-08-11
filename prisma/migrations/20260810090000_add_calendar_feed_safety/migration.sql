CREATE TYPE "CalendarConnectionStatus" AS ENUM ('NORMAL', 'RECONNECT_REQUIRED');

ALTER TABLE "CalendarSource"
ADD COLUMN "connectionStatus" "CalendarConnectionStatus" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "safetyReasonCodes" JSONB,
ADD COLUMN "feedFingerprint" JSONB,
ADD COLUMN "feedFingerprintUpdatedAt" TIMESTAMP(3);

ALTER TABLE "SyncLog"
ADD COLUMN "feedFingerprint" JSONB,
ADD COLUMN "safetyDiagnostics" JSONB,
ADD COLUMN "quarantined" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CalendarSource_connectionStatus_isActive_idx"
ON "CalendarSource"("connectionStatus", "isActive");

ALTER TABLE "Reservation"
ADD COLUMN "createdBySyncLogId" TEXT;

CREATE INDEX "Reservation_createdBySyncLogId_idx"
ON "Reservation"("createdBySyncLogId");

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_createdBySyncLogId_fkey"
FOREIGN KEY ("createdBySyncLogId") REFERENCES "SyncLog"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
