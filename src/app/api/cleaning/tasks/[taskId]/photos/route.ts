import { getTranslations } from "next-intl/server";

import { isAccessControlError, PERMISSIONS } from "@/features/access-control";
import {
  MAX_CLEANING_PHOTO_REQUEST_SIZE,
  validateCleaningPhoto,
} from "@/features/cleaning/domain/cleaning-photo-validation";
import {
  CleaningTaskNotFoundError,
  CleaningTaskStateError,
  requireCleaningTaskAccess,
} from "@/features/cleaning/server/cleaning-task-access";
import { recordCleaningPhotoAdded } from "@/features/cleaning/server/cleaning-task.service";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/prisma-errors";

export const runtime = "nodejs";

const CLIENT_UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredPhotoResponse = {
  id: string;
  storageKey: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

function sanitizeOriginalName(name: string) {
  return name
    .split(/[\\/]/).at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180) || "photo";
}

function photoResponse(photo: StoredPhotoResponse, message: string, status: number) {
  const storage = getCleaningPhotoStorage();
  return Response.json({
    success: true,
    message,
    photo: {
      id: photo.id,
      url: photo.storageKey ? storage.getUrl(photo.storageKey) : null,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
      size: photo.size,
      createdAt: photo.createdAt.toISOString(),
      deleteAfter: null,
      deletedAt: null,
    },
  }, { status, headers: { "Cache-Control": "no-store" } });
}

async function findExistingUpload(taskId: string, clientUploadId: string) {
  return prisma.cleaningPhoto.findUnique({
    where: { taskId_clientUploadId: { taskId, clientUploadId } },
    select: {
      id: true,
      storageKey: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
      deletedAt: true,
    },
  });
}

async function deleteUploadedFile(storageKey: string) {
  try {
    await getCleaningPhotoStorage().delete(storageKey);
  } catch (error) {
    logServerError("cleaning.photo.rollback", error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const t = await getTranslations("cleaning.messages");
  let storageKey: string | null = null;
  let taskId: string | null = null;
  let clientUploadId: string | null = null;
  try {
    const { taskId: routeTaskId } = await params;
    taskId = routeTaskId;
    const { context, task } = await requireCleaningTaskAccess(routeTaskId, PERMISSIONS.CLEANING_MANAGE);
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;")) {
      return Response.json({ success: false, message: t("photoInvalidType") }, { status: 415 });
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_CLEANING_PHOTO_REQUEST_SIZE) {
      return Response.json({ success: false, message: t("photoTooLarge") }, { status: 413 });
    }

    const uploadId = request.headers.get("x-cleaning-upload-id")?.trim() ?? "";
    if (!CLIENT_UPLOAD_ID_PATTERN.test(uploadId)) {
      return Response.json({ success: false, message: t("invalidRequest") }, { status: 400 });
    }
    clientUploadId = uploadId;
    const existing = await findExistingUpload(routeTaskId, uploadId);
    if (existing?.storageKey && !existing.deletedAt) {
      return photoResponse(existing, t("photoAlreadyUploaded"), 200);
    }
    if (task.status !== "PENDING" && task.status !== "IN_PROGRESS") {
      return Response.json({ success: false, message: t("notActionable") }, { status: 409 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ success: false, message: t("invalidRequest") }, { status: 400 });
    }
    const file = formData.get("photo");
    if (!(file instanceof File)) return Response.json({ success: false, message: t("photoRequired") }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateCleaningPhoto({ declaredMimeType: file.type, size: file.size, bytes });
    if (!validation.valid) {
      const key = validation.reason === "tooLarge" ? "photoTooLarge" : validation.reason === "empty" ? "photoEmpty" : "photoInvalidType";
      const status = validation.reason === "tooLarge" ? 413 : validation.reason === "invalidType" ? 415 : 400;
      return Response.json({ success: false, message: t(key) }, { status });
    }

    const storage = getCleaningPhotoStorage();
    const uploaded = await storage.upload({ taskId: routeTaskId, extension: validation.extension, data: bytes });
    storageKey = uploaded.storageKey;
    const photo = await prisma.$transaction(async (tx) => {
      const current = await tx.cleaningTask.findUnique({ where: { id: routeTaskId }, select: { status: true, assigneeName: true } });
      if (!current || (current.status !== "PENDING" && current.status !== "IN_PROGRESS")) {
        throw new CleaningTaskStateError("NOT_ACTIONABLE");
      }
      const created = await tx.cleaningPhoto.create({
        data: {
          taskId: routeTaskId,
          clientUploadId: uploadId,
          storageKey: uploaded.storageKey,
          originalName: sanitizeOriginalName(file.name),
          mimeType: validation.mimeType,
          size: file.size,
          uploadedById: context.userId,
        },
        select: { id: true, storageKey: true, originalName: true, mimeType: true, size: true, createdAt: true },
      });
      await recordCleaningPhotoAdded(tx, {
        taskId: routeTaskId,
        actorUserId: context.userId,
        workerName: current.assigneeName,
        auditMetadata: context.isRoleSwitchActive && context.developerRoleSessionId
          ? { actualRole: context.actualRole, effectiveRole: context.effectiveRole, developerRoleSessionId: context.developerRoleSessionId }
          : undefined,
      });
      return created;
    });
    storageKey = null;
    return photoResponse(photo, t("photoUploaded"), 201);
  } catch (error) {
    if (storageKey) await deleteUploadedFile(storageKey);
    if (
      taskId
      && clientUploadId
      && error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) {
      const existing = await findExistingUpload(taskId, clientUploadId);
      if (existing?.storageKey && !existing.deletedAt) {
        return photoResponse(existing, t("photoAlreadyUploaded"), 200);
      }
    }
    if (error instanceof CleaningTaskStateError) {
      return Response.json({ success: false, message: t("notActionable") }, { status: 409 });
    }
    if (error instanceof CleaningTaskNotFoundError) {
      return Response.json({ success: false, message: t("notFound") }, { status: 404 });
    }
    if (isAccessControlError(error)) return Response.json({ success: false, message: t("forbidden") }, { status: 403 });
    logServerError("cleaning.photo.upload", error);
    return Response.json({ success: false, message: t("uploadFailed") }, { status: 500 });
  }
}
