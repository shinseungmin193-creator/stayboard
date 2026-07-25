CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "digest" TEXT,
    "status" INTEGER NOT NULL,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "apiRoute" TEXT,
    "routeType" TEXT,
    "prismaError" TEXT,
    "sqlError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ErrorLog_digest_createdAt_idx" ON "ErrorLog"("digest", "createdAt");
CREATE INDEX "ErrorLog_errorCode_createdAt_idx" ON "ErrorLog"("errorCode", "createdAt");
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
