import "server-only";

import { canAccessCompany, PermissionDeniedError, requirePermission, ResourceNotFoundError, type Permission } from "@/features/access-control";
import { prisma } from "@/lib/prisma";

/** Room-note mutations intentionally use company scope, not STAFF room scope. */
export async function requireRoomNoteAccess(roomNoteId: string, permission: Permission) {
  const context = await requirePermission(permission);
  const note = await prisma.roomNote.findUnique({
    where: { id: roomNoteId },
    select: { id: true, companyId: true, propertyId: true, roomId: true, sourceType: true, cleaningTaskId: true, status: true },
  });
  if (!note) throw new ResourceNotFoundError();
  if (!canAccessCompany(context, note.companyId)) throw new PermissionDeniedError();
  return { context, note };
}
