import { z } from "zod";
import { CLEANING_WORKER_NAME_MAX_LENGTH } from "./domain/cleaning-worker";

const id = z.string().trim().min(1).max(191);
export const cleaningWorkerNameSchema = z.string().trim().min(1).max(CLEANING_WORKER_NAME_MAX_LENGTH);

export const cleaningTaskIdSchema = z.object({ taskId: id });
export const cleaningTaskAssignmentSchema = z.object({
  taskId: id,
  workerName: cleaningWorkerNameSchema.optional(),
  assigneeUserId: id,
});
export const cleaningTaskStartSchema = z.object({ taskId: id, workerName: cleaningWorkerNameSchema });
export const cleaningTaskCompletionSchema = z.object({ taskId: id, workerName: cleaningWorkerNameSchema });
export const cleaningCompletionUpdateSchema = z.object({
  taskId: id,
  workerName: cleaningWorkerNameSchema,
  completedAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(500),
});
export const cleaningTaskNoteSchema = z.object({ taskId: id, note: z.string().trim().min(1).max(500) });
export const cleaningWorkerCreateSchema = z.object({ companyId: id, name: cleaningWorkerNameSchema });
export const cleaningWorkerUpdateSchema = z.object({ id, name: cleaningWorkerNameSchema });
export const cleaningWorkerActiveSchema = z.object({ id, isActive: z.boolean() });
