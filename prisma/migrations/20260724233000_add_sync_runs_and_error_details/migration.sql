CREATE TYPE "SyncExecutionMode" AS ENUM ('AUTO', 'MANUAL');

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "executionMode" "SyncExecutionMode" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SyncLog"
ADD COLUMN "syncRunId" TEXT,
ADD COLUMN "provider" "CalendarProviderType",
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "httpStatus" INTEGER,
ADD COLUMN "errorCode" TEXT,
ADD COLUMN "errorDetails" TEXT,
ADD COLUMN "durationMs" INTEGER;

UPDATE "SyncLog" AS log
SET "provider" = source."provider"
FROM "CalendarSource" AS source
WHERE source."id" = log."calendarSourceId";

ALTER TABLE "SyncLog" ALTER COLUMN "provider" SET NOT NULL;

CREATE INDEX "SyncRun_roomId_startedAt_idx" ON "SyncRun"("roomId", "startedAt");
CREATE INDEX "SyncRun_status_startedAt_idx" ON "SyncRun"("status", "startedAt");
CREATE INDEX "SyncRun_actorUserId_startedAt_idx" ON "SyncRun"("actorUserId", "startedAt");
CREATE INDEX "SyncLog_syncRunId_createdAt_idx" ON "SyncLog"("syncRunId", "createdAt");

ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
