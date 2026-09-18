"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { hasPermission, isAccessControlError, PERMISSIONS, type AccessContext } from "@/features/access-control";
import { logServerError } from "@/lib/prisma-errors";
import {
  cleaningCompletionUpdateSchema,
  cleaningTaskAssignmentSchema,
  cleaningTaskCompletionSchema,
  cleaningTaskIdSchema,
  cleaningTaskNoteSchema,
  cleaningTaskStartSchema,
} from "./cleaning.schemas";
import { canWorkOnCleaningTask } from "./domain/cleaning-access-policy";
import { resolveCleaningAssignmentWorkerName } from "./domain/cleaning-workflow";
import { CleaningTaskStateError, requireCleaningTaskAccess } from "./server/cleaning-task-access";
import {
  assignCleaningTask,
  cancelCleaningTaskStart,
  completeCleaningTask,
  getEligibleCleaningAssignee,
  revertCleaningCompletion,
  saveCleaningTaskNote,
  startCleaningTask,
  updateCleaningCompletion,
} from "./server/cleaning-task.service";

export interface CleaningActionResult {
  success: boolean;
  message: string;
  code?: string;
}

async function errorResult(error: unknown, key: "startFailed" | "cancelStartFailed" | "assignFailed" | "completeFailed" | "completionUpdateFailed" | "completionRevertFailed" | "noteFailed"): Promise<CleaningActionResult> {
  const t = await getTranslations("cleaning.messages");
  if (error instanceof CleaningTaskStateError) {
    const messageKey = error.code === "ALREADY_COMPLETED"
      ? "alreadyCompleted"
        : error.code === "NOT_IN_PROGRESS"
          ? "notInProgress"
        : error.code === "NOT_COMPLETED"
          ? "completionChanged"
        : error.code === "INVALID_COMPLETION_TIME"
          ? "invalidCompletedAt"
        : error.code === "PHOTO_REQUIRED"
      ? "photoRequired"
      : error.code === "ASSIGNEE_REQUIRED"
        ? "assigneeRequired"
        : error.code === "INVALID_ASSIGNEE"
          ? "invalidAssignee"
          : error.code === "NAME_REQUIRED"
            ? "nameRequired"
            : error.code === "INVALID_NOTE"
              ? "invalidNote"
            : error.code === "ALREADY_ASSIGNED"
              ? "alreadyAssigned"
              : error.code === "CONFLICT"
                ? "conflict"
                : "notActionable";
    return { success: false, message: t(messageKey), code: error.code };
  }
  if (isAccessControlError(error)) return { success: false, message: t("forbidden"), code: "FORBIDDEN" };
  logServerError(`cleaning.${key}`, error);
  return { success: false, message: t(key), code: "UNKNOWN" };
}

function revalidateCleaning() {
  revalidatePath("/cleaning");
  revalidatePath("/cleaning/stats");
  revalidatePath("/");
}

function actor(context: AccessContext) {
  return {
    userId: context.userId,
    name: context.name?.trim() || "",
    auditMetadata: context.isRoleSwitchActive && context.developerRoleSessionId
      ? { actualRole: context.actualRole, effectiveRole: context.effectiveRole, developerRoleSessionId: context.developerRoleSessionId }
      : undefined,
  };
}

export async function assignCleaningTaskAction(input: {
  taskId: string;
  workerName?: string;
  assigneeUserId: string;
}): Promise<CleaningActionResult> {
  const parsed = cleaningTaskAssignmentSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidName"), code: "INVALID_NAME" };
  try {
    const { context, task } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_MANAGE);
    let assignee = {
      id: context.userId,
      name: context.name?.trim() ?? "",
      role: context.role,
    };
    let replaceExisting = false;
    if (context.role === "STAFF") {
      if (parsed.data.assigneeUserId !== context.userId) throw new CleaningTaskStateError("INVALID_ASSIGNEE");
    } else {
      if (!hasPermission(context.role, PERMISSIONS.CLEANING_ASSIGN)) return { success: false, message: t("forbidden"), code: "FORBIDDEN" };
      replaceExisting = Boolean(task.assignedToId || task.assigneeName);
      const developerSelfAssignment = context.actualRole === "DEVELOPER" && parsed.data.assigneeUserId === context.userId;
      if (!developerSelfAssignment) {
        const eligibleAssignee = await getEligibleCleaningAssignee({
          userId: parsed.data.assigneeUserId,
          companyId: task.companyId,
          propertyId: task.propertyId,
          roomId: task.roomId,
        });
        if (!eligibleAssignee) throw new CleaningTaskStateError("INVALID_ASSIGNEE");
        assignee = eligibleAssignee;
      }
    }

    const workerName = resolveCleaningAssignmentWorkerName({
      assigneeRole: assignee.role,
      accountName: assignee.name,
      workerName: parsed.data.workerName,
    });

    await assignCleaningTask(parsed.data.taskId, {
      ...actor(context),
      workerName,
      assigneeUserId: assignee.id,
      replaceExisting,
    });
    revalidateCleaning();
    return { success: true, message: t("assigned") };
  } catch (error) {
    return errorResult(error, "assignFailed");
  }
}

export async function startCleaningTaskAction(input: { taskId: string; workerName: string }): Promise<CleaningActionResult> {
  const parsed = cleaningTaskStartSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidName"), code: "INVALID_NAME" };
  try {
    const { context } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_MANAGE);
    await startCleaningTask(parsed.data.taskId, {
      ...actor(context),
      workerName: parsed.data.workerName,
      claimAssigneeUserId: context.userId,
    });
    revalidateCleaning();
    return { success: true, message: t("started") };
  } catch (error) {
    return errorResult(error, "startFailed");
  }
}

export async function cancelCleaningTaskStartAction(input: { taskId: string }): Promise<CleaningActionResult> {
  const parsed = cleaningTaskIdSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidRequest"), code: "INVALID_REQUEST" };
  try {
    const { context } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_MANAGE);
    await cancelCleaningTaskStart(parsed.data.taskId, actor(context));
    revalidateCleaning();
    return { success: true, message: t("startCancelled") };
  } catch (error) {
    return errorResult(error, "cancelStartFailed");
  }
}

export async function completeCleaningTaskAction(input: { taskId: string; workerName: string }): Promise<CleaningActionResult> {
  const parsed = cleaningTaskCompletionSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidName"), code: "INVALID_NAME" };
  try {
    const { context, task } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_MANAGE);
    if (!canWorkOnCleaningTask({
      role: context.role,
      userId: context.userId,
      assignedToId: task.assignedToId,
      assigneeName: task.assigneeName,
      assignedById: task.assignedById,
    })) throw new CleaningTaskStateError("ASSIGNEE_REQUIRED");
    await completeCleaningTask(parsed.data.taskId, { ...actor(context), workerName: parsed.data.workerName });
    revalidateCleaning();
    return { success: true, message: t("completed") };
  } catch (error) {
    return errorResult(error, "completeFailed");
  }
}

export async function updateCleaningCompletionAction(input: {
  taskId: string;
  workerName: string;
  completedAt: string;
  note: string;
}): Promise<CleaningActionResult> {
  const parsed = cleaningCompletionUpdateSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) {
    const invalidTime = parsed.error.issues.some((issue) => issue.path[0] === "completedAt");
    return { success: false, message: t(invalidTime ? "invalidCompletedAt" : "invalidCompletionUpdate"), code: invalidTime ? "INVALID_COMPLETION_TIME" : "INVALID_REQUEST" };
  }
  try {
    const { context } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_COMPLETION_MANAGE);
    await updateCleaningCompletion(parsed.data.taskId, {
      ...actor(context),
      workerName: parsed.data.workerName,
      completedAt: new Date(parsed.data.completedAt),
      note: parsed.data.note,
    });
    revalidateCleaning();
    return { success: true, message: t("completionUpdated") };
  } catch (error) {
    return errorResult(error, "completionUpdateFailed");
  }
}

export async function revertCleaningCompletionAction(input: { taskId: string }): Promise<CleaningActionResult> {
  const parsed = cleaningTaskIdSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidRequest"), code: "INVALID_REQUEST" };
  try {
    const { context } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_COMPLETION_MANAGE);
    await revertCleaningCompletion(parsed.data.taskId, actor(context));
    revalidateCleaning();
    return { success: true, message: t("completionReverted") };
  } catch (error) {
    return errorResult(error, "completionRevertFailed");
  }
}

export async function saveCleaningTaskNoteAction(input: { taskId: string; note: string }): Promise<CleaningActionResult> {
  const parsed = cleaningTaskNoteSchema.safeParse(input);
  const t = await getTranslations("cleaning.messages");
  if (!parsed.success) return { success: false, message: t("invalidNote"), code: "INVALID_NOTE" };
  try {
    const { context, task } = await requireCleaningTaskAccess(parsed.data.taskId, PERMISSIONS.CLEANING_MANAGE);
    if (!canWorkOnCleaningTask({
      role: context.role,
      userId: context.userId,
      assignedToId: task.assignedToId,
      assigneeName: task.assigneeName,
      assignedById: task.assignedById,
    })) return { success: false, message: t("forbidden"), code: "FORBIDDEN" };
    await saveCleaningTaskNote(parsed.data.taskId, { ...actor(context), note: parsed.data.note });
    revalidateCleaning();
    return { success: true, message: t("noteSaved") };
  } catch (error) {
    return errorResult(error, "noteFailed");
  }
}
