import "server-only";

import { PERMISSIONS, requireRoomAccess, type Permission } from "@/features/access-control";
import { prisma } from "@/lib/prisma";

export async function requireCleaningTaskAccess(taskId: string, permission: Permission = PERMISSIONS.CLEANING_READ) {
  const task = await prisma.cleaningTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      companyId: true,
      propertyId: true,
      roomId: true,
      status: true,
      assignedToId: true,
      assigneeName: true,
      assignedById: true,
    },
  });
  if (!task) throw new CleaningTaskNotFoundError();
  const context = await requireRoomAccess(task.roomId, permission);
  return { context, task };
}

export class CleaningTaskNotFoundError extends Error {
  constructor() {
    super("Cleaning task not found.");
    this.name = "CleaningTaskNotFoundError";
  }
}

export class CleaningTaskStateError extends Error {
  constructor(public readonly code:
    | "NOT_ACTIONABLE"
    | "PHOTO_REQUIRED"
    | "INVALID_ASSIGNEE"
    | "ASSIGNEE_REQUIRED"
    | "NAME_REQUIRED"
    | "INVALID_NOTE"
    | "ALREADY_ASSIGNED"
    | "CONFLICT") {
    super(code);
    this.name = "CleaningTaskStateError";
  }
}
