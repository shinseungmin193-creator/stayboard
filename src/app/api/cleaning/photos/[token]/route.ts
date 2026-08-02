import { isAccessControlError, PERMISSIONS, requireRoomAccess } from "@/features/access-control";
import { decodeStorageKey, getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/prisma-errors";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const storageKey = decodeStorageKey((await params).token);
    if (!storageKey) return new Response(null, { status: 404 });
    const photo = await prisma.cleaningPhoto.findUnique({
      where: { storageKey },
      select: { mimeType: true, size: true, deletedAt: true, task: { select: { roomId: true } } },
    });
    if (!photo) return new Response(null, { status: 404 });
    await requireRoomAccess(photo.task.roomId, PERMISSIONS.CLEANING_READ);
    if (photo.deletedAt) return new Response(null, { status: 410 });
    const file = await getCleaningPhotoStorage().read(storageKey);
    return new Response(file.data, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Length": String(photo.size),
        "Content-Type": photo.mimeType,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if (isAccessControlError(error) || (error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response(null, { status: 404 });
    }
    logServerError("cleaning.photo.read", error);
    return new Response(null, { status: 500 });
  }
}
