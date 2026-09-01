-- RoomListing intentionally remains separate from CalendarSource: listing pages
-- and iCal feeds have different validation, synchronization and retention rules.
CREATE TABLE "RoomListing" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "provider" "CalendarProviderType" NOT NULL,
    "listingUrl" TEXT NOT NULL,
    "externalListingId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoomListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewSnapshot" (
    "id" TEXT NOT NULL,
    "roomListingId" TEXT NOT NULL,
    "sourceListingUrl" TEXT NOT NULL,
    "rating" DECIMAL(5,2),
    "reviewCount" INTEGER,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingReview" (
    "id" TEXT NOT NULL,
    "roomListingId" TEXT NOT NULL,
    "sourceListingUrl" TEXT NOT NULL,
    "providerReviewId" TEXT,
    "reviewerName" TEXT,
    "rating" DECIMAL(5,2),
    "content" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "fingerprint" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ListingReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewSyncLog" (
    "id" TEXT NOT NULL,
    "roomListingId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "provider" "CalendarProviderType" NOT NULL,
    "sourceListingUrl" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetchedReviewCount" INTEGER NOT NULL DEFAULT 0,
    "newReviewCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomListing_roomId_provider_key" ON "RoomListing"("roomId", "provider");
CREATE INDEX "RoomListing_roomId_isActive_idx" ON "RoomListing"("roomId", "isActive");
CREATE INDEX "RoomListing_provider_isActive_idx" ON "RoomListing"("provider", "isActive");
CREATE INDEX "ReviewSnapshot_roomListingId_collectedAt_idx" ON "ReviewSnapshot"("roomListingId", "collectedAt");
CREATE INDEX "ReviewSnapshot_roomListingId_sourceListingUrl_collectedAt_idx" ON "ReviewSnapshot"("roomListingId", "sourceListingUrl", "collectedAt");
CREATE UNIQUE INDEX "ListingReview_roomListingId_fingerprint_key" ON "ListingReview"("roomListingId", "fingerprint");
CREATE INDEX "ListingReview_roomListingId_reviewedAt_idx" ON "ListingReview"("roomListingId", "reviewedAt");
CREATE INDEX "ListingReview_roomListingId_sourceListingUrl_reviewedAt_idx" ON "ListingReview"("roomListingId", "sourceListingUrl", "reviewedAt");
CREATE INDEX "ReviewSyncLog_roomListingId_startedAt_idx" ON "ReviewSyncLog"("roomListingId", "startedAt");
CREATE INDEX "ReviewSyncLog_status_startedAt_idx" ON "ReviewSyncLog"("status", "startedAt");
CREATE INDEX "ReviewSyncLog_actorUserId_startedAt_idx" ON "ReviewSyncLog"("actorUserId", "startedAt");

ALTER TABLE "RoomListing" ADD CONSTRAINT "RoomListing_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewSnapshot" ADD CONSTRAINT "ReviewSnapshot_roomListingId_fkey" FOREIGN KEY ("roomListingId") REFERENCES "RoomListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingReview" ADD CONSTRAINT "ListingReview_roomListingId_fkey" FOREIGN KEY ("roomListingId") REFERENCES "RoomListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewSyncLog" ADD CONSTRAINT "ReviewSyncLog_roomListingId_fkey" FOREIGN KEY ("roomListingId") REFERENCES "RoomListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewSyncLog" ADD CONSTRAINT "ReviewSyncLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
