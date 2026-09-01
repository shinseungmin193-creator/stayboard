"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireCompanyAccess, requirePermission } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError, isPrismaUniqueError } from "@/lib/prisma-errors";
import {
  cleaningWorkerActiveSchema,
  cleaningWorkerCreateSchema,
  cleaningWorkerUpdateSchema,
} from "./cleaning.schemas";
import type { CleaningWorkerViewModel } from "./cleaning.types";
import { CleaningWorkerNameError } from "./domain/cleaning-worker";
import {
  createCleaningWorker,
  findCleaningWorker,
  setCleaningWorkerActive,
  updateCleaningWorker,
} from "./server/cleaning-worker.repository";

function revalidateCleaningWorkers() {
  revalidatePath("/cleaning");
  revalidatePath("/cleaning/stats");
}

async function workerActionError(error: unknown): Promise<ActionResult<CleaningWorkerViewModel>> {
  const t = await getTranslations("cleaning.workers.messages");
  if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
  if (isPrismaUniqueError(error)) return { success: false, status: 409, errorCode: "VALIDATION_ERROR", message: t("duplicate") };
  if (error instanceof CleaningWorkerNameError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("invalid") };
  return actionFailureFromError(error, "cleaningWorker");
}

export async function createCleaningWorkerAction(input: unknown): Promise<ActionResult<CleaningWorkerViewModel>> {
  const t = await getTranslations("cleaning.workers.messages");
  const parsed = cleaningWorkerCreateSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("invalid") };
  try {
    const context = await requireCompanyAccess(parsed.data.companyId, PERMISSIONS.CLEANING_WORKER_CREATE);
    const worker = await createCleaningWorker(context, parsed.data);
    revalidateCleaningWorkers();
    return { success: true, data: worker, message: t("created") };
  } catch (error) {
    return workerActionError(error);
  }
}

export async function updateCleaningWorkerAction(input: unknown): Promise<ActionResult<CleaningWorkerViewModel>> {
  const t = await getTranslations("cleaning.workers.messages");
  const parsed = cleaningWorkerUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("invalid") };
  try {
    const context = await requirePermission(PERMISSIONS.CLEANING_WORKER_MANAGE);
    const current = await findCleaningWorker(context, parsed.data.id);
    if (!current) return { success: false, status: 404, errorCode: "NOT_FOUND", message: t("notFound") };
    const worker = await updateCleaningWorker(context, {
      ...parsed.data,
      companyId: current.companyId,
      previousName: current.name,
    });
    revalidateCleaningWorkers();
    return { success: true, data: worker, message: t("updated") };
  } catch (error) {
    return workerActionError(error);
  }
}

export async function setCleaningWorkerActiveAction(input: unknown): Promise<ActionResult<CleaningWorkerViewModel>> {
  const t = await getTranslations("cleaning.workers.messages");
  const parsed = cleaningWorkerActiveSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("invalid") };
  try {
    const context = await requirePermission(PERMISSIONS.CLEANING_WORKER_MANAGE);
    const current = await findCleaningWorker(context, parsed.data.id);
    if (!current) return { success: false, status: 404, errorCode: "NOT_FOUND", message: t("notFound") };
    if (current.isActive === parsed.data.isActive) {
      return { success: true, data: { ...current, companyName: current.company.name }, message: t("unchanged") };
    }
    const worker = await setCleaningWorkerActive(context, {
      ...parsed.data,
      companyId: current.companyId,
      name: current.name,
      previousActive: current.isActive,
    });
    revalidateCleaningWorkers();
    return { success: true, data: worker, message: t(parsed.data.isActive ? "activated" : "deactivated") };
  } catch (error) {
    return workerActionError(error);
  }
}
