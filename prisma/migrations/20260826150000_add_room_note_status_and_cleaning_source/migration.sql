CREATE TYPE "RoomNoteSourceType" AS ENUM ('MANUAL', 'CLEANING');
CREATE TYPE "RoomNoteStatus" AS ENUM ('OPEN', 'COMPLETED');

ALTER TABLE "RoomNote"
ADD COLUMN "sourceType" "RoomNoteSourceType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "cleaningTaskId" TEXT,
ADD COLUMN "status" "RoomNoteStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "completedByUserId" TEXT,
ADD COLUMN "completedByName" TEXT,
ALTER COLUMN "authorUserId" DROP NOT NULL,
ALTER COLUMN "content" DROP NOT NULL;

CREATE UNIQUE INDEX "RoomNote_cleaningTaskId_key" ON "RoomNote"("cleaningTaskId");

ALTER TABLE "RoomNote"
ADD CONSTRAINT "RoomNote_completedByUserId_fkey"
FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RoomNote"
ADD CONSTRAINT "RoomNote_cleaningTaskId_fkey"
FOREIGN KEY ("cleaningTaskId") REFERENCES "CleaningTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing completed cleaning notes become status-only RoomNote rows. The note
-- body and every photo remain owned by CleaningTask/CleaningPhoto.
INSERT INTO "RoomNote" (
  "id",
  "companyId",
  "propertyId",
  "roomId",
  "authorUserId",
  "authorName",
  "content",
  "sourceType",
  "cleaningTaskId",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'cleaning-room-note:' || task."id",
  task."companyId",
  task."propertyId",
  task."roomId",
  COALESCE(note_log."actorUserId", task."completedById"),
  COALESCE(note_author."name", task."completedByName", completed_user."name", '-'),
  NULL,
  'CLEANING',
  task."id",
  'OPEN',
  COALESCE(note_log."createdAt", task."completedAt", task."updatedAt"),
  COALESCE(note_log."createdAt", task."completedAt", task."updatedAt")
FROM "CleaningTask" task
LEFT JOIN LATERAL (
  SELECT log."actorUserId", log."createdAt"
  FROM "CleaningTaskLog" log
  WHERE log."taskId" = task."id" AND log."action" = 'NOTE_ADDED'
  ORDER BY log."createdAt" DESC, log."id" DESC
  LIMIT 1
) note_log ON TRUE
LEFT JOIN "User" note_author ON note_author."id" = note_log."actorUserId"
LEFT JOIN "User" completed_user ON completed_user."id" = task."completedById"
WHERE task."status" = 'COMPLETED'
  AND NULLIF(BTRIM(task."note"), '') IS NOT NULL
ON CONFLICT ("cleaningTaskId") DO NOTHING;

ALTER TABLE "RoomNote"
ADD CONSTRAINT "RoomNote_source_shape_check"
CHECK (
  ("sourceType" = 'MANUAL' AND "content" IS NOT NULL AND "cleaningTaskId" IS NULL AND "authorUserId" IS NOT NULL)
  OR
  ("sourceType" = 'CLEANING' AND "content" IS NULL AND "cleaningTaskId" IS NOT NULL)
);

DROP INDEX "RoomNote_companyId_createdAt_id_idx";
DROP INDEX "RoomNote_propertyId_createdAt_id_idx";
DROP INDEX "RoomNote_roomId_createdAt_id_idx";

CREATE INDEX "RoomNote_companyId_status_createdAt_id_idx" ON "RoomNote"("companyId", "status", "createdAt", "id");
CREATE INDEX "RoomNote_propertyId_status_createdAt_id_idx" ON "RoomNote"("propertyId", "status", "createdAt", "id");
CREATE INDEX "RoomNote_roomId_status_createdAt_id_idx" ON "RoomNote"("roomId", "status", "createdAt", "id");
CREATE INDEX "RoomNote_completedByUserId_completedAt_idx" ON "RoomNote"("completedByUserId", "completedAt");
