ALTER TABLE "RoomNote"
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "acknowledgedById" TEXT,
  ADD COLUMN "acknowledgedByName" TEXT,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "processedById" TEXT,
  ADD COLUMN "processedByName" TEXT;

CREATE INDEX "RoomNote_acknowledgedById_acknowledgedAt_idx"
  ON "RoomNote"("acknowledgedById", "acknowledgedAt");

CREATE INDEX "RoomNote_processedById_processedAt_idx"
  ON "RoomNote"("processedById", "processedAt");

ALTER TABLE "RoomNote"
  ADD CONSTRAINT "RoomNote_acknowledgedById_fkey"
  FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RoomNote"
  ADD CONSTRAINT "RoomNote_processedById_fkey"
  FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
