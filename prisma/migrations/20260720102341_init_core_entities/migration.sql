-- CreateEnum
CREATE TYPE "CalendarProviderType" AS ENUM ('AIRBNB', 'BOOKING', 'AGODA', 'EXPEDIA', 'VRBO', 'OTHER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSource" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "provider" "CalendarProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "calendarUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "provider" "CalendarProviderType" NOT NULL,
    "providerReservationId" TEXT,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "calendarSourceId" TEXT NOT NULL,
    "guestName" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL,
    "rawUid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "calendarSourceId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_isActive_name_idx" ON "Company"("isActive", "name");

-- CreateIndex
CREATE INDEX "Property_companyId_isActive_idx" ON "Property"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "Property_isActive_name_idx" ON "Property"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Property_companyId_name_key" ON "Property"("companyId", "name");

-- CreateIndex
CREATE INDEX "Room_propertyId_isActive_sortOrder_idx" ON "Room"("propertyId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Room_isActive_idx" ON "Room"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_code_key" ON "Room"("propertyId", "code");

-- CreateIndex
CREATE INDEX "CalendarSource_roomId_isActive_idx" ON "CalendarSource"("roomId", "isActive");

-- CreateIndex
CREATE INDEX "CalendarSource_provider_isActive_idx" ON "CalendarSource"("provider", "isActive");

-- CreateIndex
CREATE INDEX "CalendarSource_isActive_lastSyncedAt_idx" ON "CalendarSource"("isActive", "lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSource_roomId_calendarUrl_key" ON "CalendarSource"("roomId", "calendarUrl");

-- CreateIndex
CREATE INDEX "Reservation_roomId_startDate_endDate_idx" ON "Reservation"("roomId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Reservation_propertyId_startDate_endDate_idx" ON "Reservation"("propertyId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Reservation_startDate_status_idx" ON "Reservation"("startDate", "status");

-- CreateIndex
CREATE INDEX "Reservation_endDate_status_idx" ON "Reservation"("endDate", "status");

-- CreateIndex
CREATE INDEX "Reservation_calendarSourceId_status_idx" ON "Reservation"("calendarSourceId", "status");

-- CreateIndex
CREATE INDEX "Reservation_provider_providerReservationId_idx" ON "Reservation"("provider", "providerReservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_calendarSourceId_rawUid_key" ON "Reservation"("calendarSourceId", "rawUid");

-- CreateIndex
CREATE INDEX "SyncLog_calendarSourceId_createdAt_idx" ON "SyncLog"("calendarSourceId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncLog_status_createdAt_idx" ON "SyncLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncLog_calendarSourceId_status_startedAt_idx" ON "SyncLog"("calendarSourceId", "status", "startedAt");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSource" ADD CONSTRAINT "CalendarSource_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_calendarSourceId_fkey" FOREIGN KEY ("calendarSourceId") REFERENCES "CalendarSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_calendarSourceId_fkey" FOREIGN KEY ("calendarSourceId") REFERENCES "CalendarSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
