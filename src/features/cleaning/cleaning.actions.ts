"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { hasPermission, isAccessControlError, PERMISSIONS, type AccessContext } from "@/features/access-control";
import { logServerError } from "@/lib/prisma-errors";
import {
  cleaningTaskAssignmentSchema,
  cleaningTaskCompletionSchema,
  cleaningTaskNoteSchema,
  cleaningTaskStartSchema,
} from "./cleaning.schemas";
import { canWorkOnCleaningTask } from "./domain/cleaning-access-policy";
import { resolveCleaningAssignmentWorkerName } from "./domain/cleaning-workflow";
import { CleaningTaskStateError, requireCleaningTaskAccess } from "./server/cleaning-task-access";
import {
  assignCleaningTask,
  completeCleaningTask,
  getEligibleCleaningAssignee,
  saveCleaningTaskNote,
  startCleaningTask,
} from "./server/cleaning-task.service";

export interface CleaningActionResult {
  success: boolean;
  message: string;
  code?: string;
}

async function errorResult(error: unknown, key: "startFailed" | "assignFailed" | "completeFailed" | "noteFailed"): Promise<CleaningActionResult> {
  const t = await getTranslations("cleaning.messages");
  if (error instanceof CleaningTaskStateError) {
    const messageKey = error.code === "PHOTO_REQUIRED"
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
