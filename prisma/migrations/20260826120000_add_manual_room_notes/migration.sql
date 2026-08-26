-- Cleaning notes remain in CleaningTask.note. This table stores only notes
-- authored directly from the room notes page to avoid duplicated source data.
CREATE TABLE "RoomNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomNote_companyId_createdAt_id_idx" ON "RoomNote"("companyId", "createdAt", "id");
CREATE INDEX "RoomNote_propertyId_createdAt_id_idx" ON "RoomNote"("propertyId", "createdAt", "id");
CREATE INDEX "RoomNote_roomId_createdAt_id_idx" ON "RoomNote"("roomId", "createdAt", "id");
CREATE INDEX "RoomNote_authorUserId_createdAt_idx" ON "RoomNote"("authorUserId", "createdAt");

ALTER TABLE "RoomNote" ADD CONSTRAINT "RoomNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomNote" ADD CONSTRAINT "RoomNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomNote" ADD CONSTRAINT "RoomNote_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomNote" ADD CONSTRAINT "RoomNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
