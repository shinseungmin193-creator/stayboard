import { isAccessControlError, PERMISSIONS, requireRoomAccess } from "@/features/access-control";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/prisma-errors";

export const runtime = "nodejs";

async function findPhoto(photoId: string) {
  return prisma.cleaningPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, storageKey: true, mimeType: true, size: true, deletedAt: true, task: { select: { id: true, roomId: true, status: true } } },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const photo = await findPhoto((await params).photoId);
    if (!photo?.storageKey || photo.deletedAt) return new Response(null, { status: 404 });
    await requireRoomAccess(photo.task.roomId, PERMISSIONS.CLEANING_READ);
    const file = await getCleaningPhotoStorage().read(photo.storageKey);
    return new Response(file.data, { headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(photo.size),
      "Content-Type": photo.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (isAccessControlError(error) || (error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    logServerError("cleaning.photo.read", error);
    return new Response(null, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const photo = await findPhoto((await params).photoId);
    if (!photo?.storageKey || photo.deletedAt) return Response.json({ success: false }, { status: 404 });
    const context = await requireRoomAccess(photo.task.roomId, PERMISSIONS.CLEANING_MANAGE);
    const isManager = context.effectiveRole === "ADMIN" || context.effectiveRole === "DEVELOPER";
    if (photo.task.status === "COMPLETED" && !isManager) return Response.json({ success: false }, { status: 409 });
    await getCleaningPhotoStorage().delete(photo.storageKey);
    await prisma.cleaningPhoto.updateMany({
      where: { id: photo.id, storageKey: photo.storageKey, deletedAt: null },
      data: { storageKey: null, deletedAt: new Date(), deleteAfter: null, deleteError: null },
    });
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isAccessControlError(error)) return Response.json({ success: false }, { status: 403 });
    logServerError("cleaning.photo.delete", error);
    return Response.json({ success: false }, { status: 500 });
  }
}
