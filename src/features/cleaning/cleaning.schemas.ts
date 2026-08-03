import { z } from "zod";

const id = z.string().trim().min(1).max(191);
export const cleaningWorkerNameSchema = z.string().trim().min(1).max(30);

export const cleaningTaskIdSchema = z.object({ taskId: id });
export const cleaningTaskAssignmentSchema = z.object({
  taskId: id,
  workerName: cleaningWorkerNameSchema.optional(),
  assigneeUserId: id,
});
export const cleaningTaskStartSchema = z.object({ taskId: id, workerName: cleaningWorkerNameSchema.optional() });
export const cleaningTaskCompletionSchema = z.object({ taskId: id, workerName: cleaningWorkerNameSchema.optional() });
export const cleaningTaskNoteSchema = z.object({ taskId: id, note: z.string().trim().min(1).max(500) });
