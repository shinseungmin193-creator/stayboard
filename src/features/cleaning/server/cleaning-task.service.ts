import "server-only";

import { prisma } from "@/lib/prisma";
import { getCleaningPhotoDeleteAfter, MIN_REQUIRED_CLEANING_PHOTOS } from "../domain/cleaning-retention";
import { CleaningTaskStateError } from "./cleaning-task-access";

const ACTIONABLE_STATUSES = ["PENDING", "IN_PROGRESS"] as const;

export async function startCleaningTask(taskId: string, claimForUserId?: string) {
  const started = await prisma.cleaningTask.updateMany({
    where: { id: taskId, status: "PENDING" },
    data: { status: "IN_PROGRESS", startedAt: new Date(), ...(claimForUserId ? { assignedToId: claimForUserId } : {}) },
  });
  if (started.count) return;
  const current = await prisma.cleaningTask.findUnique({ where: { id: taskId }, select: { status: true, assignedToId: true } });
  if (current?.status !== "IN_PROGRESS") throw new CleaningTaskStateError("NOT_ACTIONABLE");
  if (claimForUserId && !current.assignedToId) {
    await prisma.cleaningTask.updateMany({ where: { id: taskId, status: "IN_PROGRESS", assignedToId: null }, data: { assignedToId: claimForUserId } });
  }
}

export async function assignCleaningTask(taskId: string, assignedToId: string | null) {
  const updated = await prisma.cleaningTask.updateMany({
    where: { id: taskId, status: { in: [...ACTIONABLE_STATUSES] } },
    data: { assignedToId },
  });
  if (!updated.count) throw new CleaningTaskStateError("NOT_ACTIONABLE");
}

export async function completeCleaningTask(taskId: string, completedById: string, completedAt = new Date()) {
  await prisma.$transaction(async (tx) => {
    const task = await tx.cleaningTask.findUnique({
      where: { id: taskId },
      select: {
        status: true,
        photos: { where: { storageKey: { not: null }, deletedAt: null }, select: { id: true }, take: MIN_REQUIRED_CLEANING_PHOTOS },
      },
    });
    if (!task || !ACTIONABLE_STATUSES.includes(task.status as (typeof ACTIONABLE_STATUSES)[number])) {
      throw new CleaningTaskStateError("NOT_ACTIONABLE");
    }
    if (task.photos.length < MIN_REQUIRED_CLEANING_PHOTOS) throw new CleaningTaskStateError("PHOTO_REQUIRED");

    const completed = await tx.cleaningTask.updateMany({
      where: { id: taskId, status: { in: [...ACTIONABLE_STATUSES] } },
      data: { status: "COMPLETED", completedAt, completedById },
    });
    if (!completed.count) throw new CleaningTaskStateError("NOT_ACTIONABLE");
    await tx.cleaningPhoto.updateMany({
      where: { taskId, storageKey: { not: null }, deletedAt: null },
      data: { deleteAfter: getCleaningPhotoDeleteAfter(completedAt), deleteError: null },
    });
  });
}

export async function isEligibleCleaningAssignee(input: { userId: string; companyId: string; propertyId: string; roomId: string }) {
  const membership = await prisma.companyMembership.findFirst({
    where: {
      userId: input.userId,
      companyId: input.companyId,
      status: "ACTIVE",
      user: { isActive: true, status: "ACTIVE" },
      OR: [
        { role: "ADMIN" },
        { propertyAccesses: { some: { propertyId: input.propertyId } } },
        { user: { assignments: { some: { OR: [{ propertyId: input.propertyId }, { roomId: input.roomId }] } } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(membership);
}
