-- CreateEnum
CREATE TYPE "CleaningTaskLogAction" AS ENUM ('ASSIGNED', 'REASSIGNED', 'STARTED', 'COMPLETED', 'NOTE_ADDED', 'PHOTO_ADDED');

-- AlterTable
ALTER TABLE "CleaningTask" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "assigneeName" TEXT,
ADD COLUMN     "completedByName" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "startedById" TEXT,
ADD COLUMN     "startedByName" TEXT;

-- CreateTable
CREATE TABLE "CleaningTaskLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "action" "CleaningTaskLogAction" NOT NULL,
    "actorUserId" TEXT,
    "workerName" TEXT,
    "previousStatus" "CleaningTaskStatus",
    "nextStatus" "CleaningTaskStatus",
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningTaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CleaningTaskLog_taskId_createdAt_idx" ON "CleaningTaskLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "CleaningTaskLog_actorUserId_createdAt_idx" ON "CleaningTaskLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CleaningTaskLog_action_createdAt_idx" ON "CleaningTaskLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "CleaningTask_assignedById_assignedAt_idx" ON "CleaningTask"("assignedById", "assignedAt");

-- CreateIndex
CREATE INDEX "CleaningTask_startedById_startedAt_idx" ON "CleaningTask"("startedById", "startedAt");

-- AddForeignKey
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningTaskLog" ADD CONSTRAINT "CleaningTaskLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CleaningTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningTaskLog" ADD CONSTRAINT "CleaningTaskLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
