import { getTranslations } from "next-intl/server";

import { isAccessControlError, PERMISSIONS } from "@/features/access-control";
import { validateCleaningPhoto } from "@/features/cleaning/domain/cleaning-photo-validation";
import { canWorkOnCleaningTask } from "@/features/cleaning/domain/cleaning-access-policy";
import { CleaningTaskStateError, requireCleaningTaskAccess } from "@/features/cleaning/server/cleaning-task-access";
import { recordCleaningPhotoAdded } from "@/features/cleaning/server/cleaning-task.service";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/prisma-errors";

export const runtime = "nodejs";

function sanitizeOriginalName(name: string) {
  return name
    .split(/[\\/]/).at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180) || "photo";
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const t = await getTranslations("cleaning.messages");
  let storageKey: string | null = null;
  try {
    const { taskId } = await params;
    const { context, task } = await requireCleaningTaskAccess(taskId, PERMISSIONS.CLEANING_MANAGE);
    if (!canWorkOnCleaningTask({
      role: context.role,
      userId: context.userId,
      assignedToId: task.assignedToId,
      assigneeName: task.assigneeName,
      assignedById: task.assignedById,
    })) {
      return Response.json({ success: false, message: t("forbidden") }, { status: 403 });
    }
    if (task.status !== "PENDING" && task.status !== "IN_PROGRESS") {
      return Response.json({ success: false, message: t("notActionable") }, { status: 409 });
    }

    const formData = await request.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) return Response.json({ success: false, message: t("photoRequired") }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateCleaningPhoto({ declaredMimeType: file.type, size: file.size, bytes });
    if (!validation.valid) {
      const key = validation.reason === "tooLarge" ? "photoTooLarge" : validation.reason === "empty" ? "photoEmpty" : "photoInvalidType";
      return Response.json({ success: false, message: t(key) }, { status: 400 });
    }

    const storage = getCleaningPhotoStorage();
    const uploaded = await storage.upload({ taskId, extension: validation.extension, data: bytes });
    storageKey = uploaded.storageKey;
    const photo = await prisma.$transaction(async (tx) => {
      const current = await tx.cleaningTask.findUnique({ where: { id: taskId }, select: { status: true, assigneeName: true } });
      if (!current || (current.status !== "PENDING" && current.status !== "IN_PROGRESS")) {
        throw new CleaningTaskStateError("NOT_ACTIONABLE");
      }
      const created = await tx.cleaningPhoto.create({
        data: {
          taskId,
          storageKey: uploaded.storageKey,
          originalName: sanitizeOriginalName(file.name),
          mimeType: validation.mimeType,
          size: file.size,
          uploadedById: context.userId,
        },
        select: { id: true, storageKey: true },
      });
      await recordCleaningPhotoAdded(tx, {
        taskId,
        actorUserId: context.userId,
        workerName: current.assigneeName,
        auditMetadata: context.isRoleSwitchActive && context.developerRoleSessionId
          ? { actualRole: context.actualRole, effectiveRole: context.effectiveRole, developerRoleSessionId: context.developerRoleSessionId }
          : undefined,
      });
      return created;
    });
    storageKey = null;
    return Response.json({
      success: true,
      message: t("photoUploaded"),
      photo: { id: photo.id, url: storage.getUrl(photo.storageKey!) },
    }, { status: 201 });
  } catch (error) {
    if (storageKey) {
      try { await getCleaningPhotoStorage().delete(storageKey); } catch { /* The cleanup command can retry DB-backed files only. */ }
    }
    if (error instanceof CleaningTaskStateError) {
      return Response.json({ success: false, message: t("notActionable") }, { status: 409 });
    }
    if (isAccessControlError(error)) return Response.json({ success: false, message: t("forbidden") }, { status: 403 });
    logServerError("cleaning.photo.upload", error);
    return Response.json({ success: false, message: t("uploadFailed") }, { status: 500 });
  }
}
