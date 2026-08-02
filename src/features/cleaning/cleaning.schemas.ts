import { z } from "zod";

const id = z.string().trim().min(1).max(191);

export const cleaningTaskIdSchema = z.object({ taskId: id });
export const cleaningTaskAssignmentSchema = z.object({
  taskId: id,
  assignedToId: z.union([id, z.null()]),
});
