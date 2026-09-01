import "server-only";

import type { CleaningTaskStatus, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CleaningWorkflowError,
  normalizeCleaningWorkerName,
  planCleaningAssignment,
  planCleaningCompletion,
  planCleaningStart,
  planCleaningStartCancellation,
  type CleaningWorkflowSnapshot,
} from "../domain/cleaning-workflow";
import { getCleaningPhotoDeleteAfter, MIN_REQUIRED_CLEANING_PHOTOS } from "../domain/cleaning-retention";
import { CleaningTaskStateError } from "./cleaning-task-access";

const ACTIONABLE_STATUSES = ["PENDING", "IN_PROGRESS"] as const;

interface CleaningActor {
  userId: string;
  name: string;
  auditMetadata?: Prisma.InputJsonObject;
}

function workflowSnapshot(task: {
  status: CleaningTaskStatus;
  assignedToId: string | null;
  assigneeName: string | null;
  assignedById: string | null;
  assignedTo?: { name: string } | null;
}): CleaningWorkflowSnapshot {
  return {
    status: task.status,
    assigneeUserId: task.assignedToId,
    assigneeName: task.assigneeName ?? task.assignedTo?.name ?? null,
    assignedByUserId: task.assignedById,
  };
}

function translateWorkflowError(error: unknown): never {
  if (error instanceof CleaningWorkflowError) {
    const code = error.code === "NAME_REQUIRED" ? "NAME_REQUIRED" : error.code;
    throw new CleaningTaskStateError(code);
  }
  throw error;
}

async function createLog(tx: Prisma.TransactionClient, input: {
  taskId: string;
  action: "ASSIGNED" | "REASSIGNED" | "STARTED" | "START_CANCELLED" | "COMPLETED" | "NOTE_ADDED" | "PHOTO_ADDED";
  actorUserId: string;
  workerName?: string | null;
  previousStatus?: CleaningTaskStatus | null;
  nextStatus?: CleaningTaskStatus | null;
  details?: Prisma.InputJsonValue;
  auditMetadata?: Prisma.InputJsonObject;
}) {
  const details = input.details && typeof input.details === "object" && !Array.isArray(input.details)
    ? { ...(input.details as Prisma.InputJsonObject), ...(input.auditMetadata ?? {}) }
    : input.auditMetadata;
  await tx.cleaningTaskLog.create({
    data: {
      taskId: input.taskId,
      action: input.action,
      actorUserId: input.actorUserId,
      workerName: input.workerName,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      details,
    },
  });
}

export async function assignCleaningTask(taskId: string, input: CleaningActor & {
  workerName: string;
  assigneeUserId: string | null;
  replaceExisting?: boolean;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findUnique({
        where: { id: taskId },
        select: { status: true, assignedToId: true, assigneeName: true, assignedById: true, updatedAt: true, assignedTo: { select: { name: true } } },
      });
      if (!task) throw new CleaningTaskStateError("NOT_ACTIONABLE");
      const snapshot = workflowSnapshot(task);
      const workerName = input.replaceExisting
        ? normalizeCleaningWorkerName(input.workerName)
        : planCleaningAssignment(snapshot, input.workerName).workerName;
      const assignedAt = new Date();
      const updated = await tx.cleaningTask.updateMany({
        where: { id: taskId, status: { in: [...ACTIONABLE_STATUSES] }, updatedAt: task.updatedAt },
        data: {
          assignedToId: input.assigneeUserId,
          assigneeName: workerName,
          assignedById: input.userId,
          assignedAt,
        },
      });
      if (!updated.count) throw new CleaningTaskStateError("CONFLICT");
      await createLog(tx, {
        taskId,
        action: snapshot.assigneeUserId || snapshot.assigneeName ? "REASSIGNED" : "ASSIGNED",
        actorUserId: input.userId,
        workerName,
        previousStatus: task.status,
        nextStatus: task.status,
        auditMetadata: input.auditMetadata,
      });
    });
  } catch (error) {
    translateWorkflowError(error);
  }
}

export async function startCleaningTask(taskId: string, input: CleaningActor & {
  workerName: string;
  claimAssigneeUserId?: string | null;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findUnique({
        where: { id: taskId },
        select: { status: true, assignedToId: true, assigneeName: true, assignedById: true, updatedAt: true, assignedTo: { select: { name: true } } },
      });
      if (!task) throw new CleaningTaskStateError("NOT_ACTIONABLE");
      const snapshot = workflowSnapshot(task);
      const plan = planCleaningStart(snapshot, input.workerName);
      const workerName = plan.workerName;
      const startedAt = new Date();
      const updated = await tx.cleaningTask.updateMany({
        where: { id: taskId, status: "PENDING", updatedAt: task.updatedAt },
        data: {
          status: "IN_PROGRESS",
          startedAt,
          startedById: input.userId,
          startedByName: input.name,
          cleanerName: workerName,
          ...(plan.shouldAssign ? {
            assignedToId: input.claimAssigneeUserId ?? input.userId,
            assigneeName: workerName,
            assignedById: input.userId,
            assignedAt: startedAt,
          } : task.assigneeName ? {} : { assigneeName: workerName }),
        },
      });
      if (!updated.count) throw new CleaningTaskStateError("CONFLICT");
      if (plan.shouldAssign) {
        await createLog(tx, { taskId, action: "ASSIGNED", actorUserId: input.userId, workerName, previousStatus: "PENDING", nextStatus: "PENDING", auditMetadata: input.auditMetadata });
      }
      await createLog(tx, { taskId, action: "STARTED", actorUserId: input.userId, workerName, previousStatus: "PENDING", nextStatus: "IN_PROGRESS", auditMetadata: input.auditMetadata });
    });
  } catch (error) {
    translateWorkflowError(error);
  }
}

export async function cancelCleaningTaskStart(taskId: string, input: CleaningActor) {
  try {
    await prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findUnique({
        where: { id: taskId },
        select: { status: true, cleanerName: true, updatedAt: true },
      });
      if (!task) throw new CleaningTaskStateError("NOT_ACTIONABLE");
      const reset = planCleaningStartCancellation(task.status);
      const updated = await tx.cleaningTask.updateMany({
        where: { id: taskId, status: "IN_PROGRESS", updatedAt: task.updatedAt },
        data: reset,
      });
      if (!updated.count) throw new CleaningTaskStateError("CONFLICT");
      await createLog(tx, {
        taskId,
        action: "START_CANCELLED",
        actorUserId: input.userId,
        workerName: task.cleanerName,
        previousStatus: "IN_PROGRESS",
        nextStatus: "PENDING",
        auditMetadata: input.auditMetadata,
      });
    });
  } catch (error) {
    translateWorkflowError(error);
  }
}

export async function completeCleaningTask(taskId: string, input: CleaningActor & { workerName: string }, completedAt = new Date()) {
  try {
    await prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          companyId: true,
          propertyId: true,
          roomId: true,
          note: true,
          status: true,
          assignedToId: true,
          assigneeName: true,
          assignedById: true,
          updatedAt: true,
          assignedTo: { select: { name: true } },
          logs: {
            where: { action: "NOTE_ADDED" },
            select: { actorUserId: true, createdAt: true, actor: { select: { name: true } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
          },
          photos: { where: { storageKey: { not: null }, deletedAt: null }, select: { id: true }, take: MIN_REQUIRED_CLEANING_PHOTOS },
        },
      });
      if (!task) throw new CleaningTaskStateError("NOT_ACTIONABLE");
      if (task.photos.length < MIN_REQUIRED_CLEANING_PHOTOS) throw new CleaningTaskStateError("PHOTO_REQUIRED");
      const snapshot = workflowSnapshot(task);
      const plan = planCleaningCompletion(snapshot, input.workerName);
      const workerName = plan.workerName;
      const updated = await tx.cleaningTask.updateMany({
        where: { id: taskId, status: { in: [...ACTIONABLE_STATUSES] }, updatedAt: task.updatedAt },
        data: {
          status: "COMPLETED",
          completedAt,
          completedById: input.userId,
          completedByName: input.name,
          cleanerName: workerName,
          ...(plan.shouldAssign ? {
            assignedToId: input.userId,
            assigneeName: workerName,
            assignedById: input.userId,
            assignedAt: completedAt,
          } : task.assigneeName ? {} : { assigneeName: workerName }),
        },
      });
      if (!updated.count) throw new CleaningTaskStateError("CONFLICT");
      if (plan.shouldAssign) {
        await createLog(tx, { taskId, action: "ASSIGNED", actorUserId: input.userId, workerName, previousStatus: task.status, nextStatus: task.status, auditMetadata: input.auditMetadata });
      }
      await createLog(tx, { taskId, action: "COMPLETED", actorUserId: input.userId, workerName, previousStatus: task.status, nextStatus: "COMPLETED", auditMetadata: input.auditMetadata });
      const note = task.note?.trim();
      if (note) {
        const noteLog = task.logs[0];
        await tx.roomNote.upsert({
          where: { cleaningTaskId: task.id },
          create: {
            companyId: task.companyId,
            propertyId: task.propertyId,
            roomId: task.roomId,
            authorUserId: noteLog?.actorUserId ?? input.userId,
            authorName: noteLog?.actor?.name ?? (input.name || workerName),
            content: null,
            sourceType: "CLEANING",
            cleaningTaskId: task.id,
            status: "OPEN",
            createdAt: noteLog?.createdAt ?? completedAt,
          },
          update: {
            companyId: task.companyId,
            propertyId: task.propertyId,
            roomId: task.roomId,
            authorUserId: noteLog?.actorUserId ?? input.userId,
            authorName: noteLog?.actor?.name ?? (input.name || workerName),
            content: null,
            sourceType: "CLEANING",
          },
        });
      }
      await tx.cleaningPhoto.updateMany({
        where: { taskId, storageKey: { not: null }, deletedAt: null },
        data: { deleteAfter: getCleaningPhotoDeleteAfter(completedAt), deleteError: null },
      });
    });
  } catch (error) {
    translateWorkflowError(error);
  }
}

export async function saveCleaningTaskNote(taskId: string, input: CleaningActor & { note: string }) {
  const note = input.note.trim();
  if (!note || note.length > 500) throw new CleaningTaskStateError("INVALID_NOTE");
  await prisma.$transaction(async (tx) => {
    const task = await tx.cleaningTask.findUnique({ where: { id: taskId }, select: { status: true, updatedAt: true } });
    if (!task || !ACTIONABLE_STATUSES.includes(task.status as (typeof ACTIONABLE_STATUSES)[number])) {
      throw new CleaningTaskStateError("NOT_ACTIONABLE");
    }
    const updated = await tx.cleaningTask.updateMany({ where: { id: taskId, updatedAt: task.updatedAt }, data: { note } });
    if (!updated.count) throw new CleaningTaskStateError("CONFLICT");
    await createLog(tx, {
      taskId,
      action: "NOTE_ADDED",
      actorUserId: input.userId,
      previousStatus: task.status,
      nextStatus: task.status,
      details: { length: note.length },
      auditMetadata: input.auditMetadata,
    });
  });
}

export async function recordCleaningPhotoAdded(tx: Prisma.TransactionClient, input: { taskId: string; actorUserId: string; workerName?: string | null; auditMetadata?: Prisma.InputJsonObject }) {
  await createLog(tx, { taskId: input.taskId, action: "PHOTO_ADDED", actorUserId: input.actorUserId, workerName: input.workerName, auditMetadata: input.auditMetadata });
}

export async function getEligibleCleaningAssignee(input: { userId: string; companyId: string; propertyId: string; roomId: string }) {
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
    select: { role: true, user: { select: { id: true, name: true } } },
  });
  return membership ? { id: membership.user.id, name: membership.user.name, role: membership.role } : null;
}
