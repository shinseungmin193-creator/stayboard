CREATE TABLE "RoomNotePhoto" (
  "id" TEXT NOT NULL,
  "roomNoteId" TEXT NOT NULL,
  "clientUploadId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RoomNotePhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomNotePhoto_storageKey_key" ON "RoomNotePhoto"("storageKey");
CREATE UNIQUE INDEX "RoomNotePhoto_roomNoteId_clientUploadId_key" ON "RoomNotePhoto"("roomNoteId", "clientUploadId");
CREATE INDEX "RoomNotePhoto_roomNoteId_createdAt_idx" ON "RoomNotePhoto"("roomNoteId", "createdAt");
CREATE INDEX "RoomNotePhoto_uploadedById_createdAt_idx" ON "RoomNotePhoto"("uploadedById", "createdAt");

ALTER TABLE "RoomNotePhoto"
  ADD CONSTRAINT "RoomNotePhoto_roomNoteId_fkey"
  FOREIGN KEY ("roomNoteId") REFERENCES "RoomNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomNotePhoto"
  ADD CONSTRAINT "RoomNotePhoto_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
