"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import {
  getRolePreviewWriteBlock,
  hasPermission,
  isAccessControlError,
  PERMISSIONS,
} from "@/features/access-control";
import { logServerError } from "@/lib/prisma-errors";
import { cleaningTaskAssignmentSchema, cleaningTaskIdSchema } from "./cleaning.schemas";
import { canWorkOnCleaningTask } from "./domain/cleaning-access-policy";
import { CleaningTaskStateError, requireCleaningTaskAccess } from "./server/cleaning-task-access";
import {
  assignCleaningTask,
  completeCleaningTask,
  isEligibleCleaningAssignee,
  startCleaningTask,
} from "./server/cleaning-task.service";

export interface CleaningActionResult {
  success: boolean;
  message: string;
}

async function errorResult(error: unknown, key: "startFailed" | "assignFailed" | "completeFailed"): Promise<CleaningActionResult> {
  const t = await getTranslations("cleaning.messages");
  if (error instanceof CleaningTaskStateError) {
    if (error.code === "PHOTO_REQUIRED") return { success: false, message: t("photoRequired") };
    if (error.code === "ASSIGNEE_REQUIRED") return { success: false, message: t("assigneeRequired") };
    if (error.code === "INVALID_ASSIGNEE") return { success: false, message: t("invalidAssignee") };
    return { success: false, message: t("notActionable") };
  }
  if (isAccessControlError(error)) return { success: false, message: t("forbidden") };
  logServerError(`cleaning.${key}`, error);
  return { success: false, message: t(key) };
}

function revalidateCleaning() {
  revalidatePath("/cleaning");
  revalidatePath("/");
}

export async function startCleaningTaskAction(input: { taskId: string }): Promise<CleaningActionResult> {
  const parsed = cleaningTaskIdSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidRequest") };
  try {
    const { context, task } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_MANAGE);
    const previewBlock = getRolePreviewWriteBlock(context);
    if (previewBlock) return { success: false, message: t("previewBlocked") };
    if (!canWorkOnCleaningTask({ role: context.role, userId: context.userId, assignedToId: task.assignedToId })) {
      return { success: false, message: t("forbidden") };
    }
    await startCleaningTask(parsed.data.taskId, context.role === "STAFF" ? context.userId : undefined);
    revalidateCleaning();
    return { success: true, message: t("started") };
  } catch (error) {
    return errorResult(error, "startFailed");
  }
}

export async function assignCleaningTaskAction(input: { taskId: string; assignedToId: string | null }): Promise<CleaningActionResult> {
  const parsed = cleaningTaskAssignmentSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidRequest") };
  try {
    const { context, task } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_MANAGE);
    const previewBlock = getRolePreviewWriteBlock(context);
    if (previewBlock) return { success: false, message: t("previewBlocked") };

    if (context.role === "STAFF") {
      const canAssignSelf = parsed.data.assignedToId === context.userId;
      const canUnassignSelf = parsed.data.assignedToId === null && task.assignedToId === context.userId;
      if (!canAssignSelf && !canUnassignSelf) return { success: false, message: t("forbidden") };
    } else {
      if (!hasPermission(context.role, PERMISSIONS.CLEANING_ASSIGN)) return { success: false, message: t("forbidden") };
      if (parsed.data.assignedToId && !await isEligibleCleaningAssignee({
        userId: parsed.data.assignedToId,
        companyId: task.companyId,
        propertyId: task.propertyId,
        roomId: task.roomId,
      })) throw new CleaningTaskStateError("INVALID_ASSIGNEE");
    }

    await assignCleaningTask(parsed.data.taskId, parsed.data.assignedToId);
    revalidateCleaning();
    return { success: true, message: t("assigned") };
  } catch (error) {
    return errorResult(error, "assignFailed");
  }
}

export async function completeCleaningTaskAction(input: { taskId: string }): Promise<CleaningActionResult> {
  const parsed = cleaningTaskIdSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidRequest") };
  try {
    const { context, task } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_MANAGE);
    const previewBlock = getRolePreviewWriteBlock(context);
    if (previewBlock) return { success: false, message: t("previewBlocked") };
    if (!canWorkOnCleaningTask({ role: context.role, userId: context.userId, assignedToId: task.assignedToId })) {
      throw new CleaningTaskStateError("ASSIGNEE_REQUIRED");
    }
    await completeCleaningTask(parsed.data.taskId, context.userId);
    revalidateCleaning();
    return { success: true, message: t("completed") };
  } catch (error) {
    return errorResult(error, "completeFailed");
  }
}
