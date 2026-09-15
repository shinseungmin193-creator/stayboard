import type { CleaningTaskStatus } from "@/lib/generated/prisma/enums";

export function isCleaningRecordCompleted<T extends {
  status: CleaningTaskStatus;
  completedAt: string | Date | null | undefined;
}>(task: T) {
  return task.status === "COMPLETED" || Boolean(task.completedAt);
}
