-- CreateTable
CREATE TABLE "SidebarPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuOrder" JSONB NOT NULL,
    "hiddenMenuIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SidebarPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SidebarPreference_userId_key" ON "SidebarPreference"("userId");

-- CreateIndex
CREATE INDEX "SidebarPreference_userId_idx" ON "SidebarPreference"("userId");
