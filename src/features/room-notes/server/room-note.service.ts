import "server-only";

import { canAccessCompany, canAccessRoom, PermissionDeniedError, withAccessAuditMetadata, type AccessContext } from "@/features/access-control";
import { prisma } from "@/lib/prisma";

export class RoomNoteServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomNoteServiceError";
  }
}

export async function createManualRoomNote(context: AccessContext, input: { propertyId: string; roomId: string; content: string }) {
  const content = input.content.trim();
  if (!content || content.length > 1000) throw new RoomNoteServiceError("메모 내용을 확인해 주세요.");
  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    select: {
      id: true,
      propertyId: true,
      isActive: true,
      property: { select: { companyId: true, isActive: true, company: { select: { isActive: true } } } },
    },
  });
  if (!room || room.propertyId !== input.propertyId) throw new RoomNoteServiceError("선택한 객실을 찾을 수 없습니다.");
  if (!canAccessCompany(context, room.property.companyId) || !canAccessRoom(context, room)) throw new PermissionDeniedError();
  if (!room.isActive || !room.property.isActive || !room.property.company.isActive) throw new RoomNoteServiceError("활성 상태인 객실에만 메모를 추가할 수 있습니다.");
  const authorName = context.name?.trim();
  if (!authorName) throw new RoomNoteServiceError("작성자 정보를 확인할 수 없습니다.");

  return prisma.$transaction(async (tx) => {
    const note = await tx.roomNote.create({
      data: {
        companyId: room.property.companyId,
        propertyId: room.propertyId,
        roomId: room.id,
        authorUserId: context.userId,
        authorName,
        content,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: room.property.companyId,
        action: "ROOM_NOTE_CREATED",
        details: withAccessAuditMetadata(context, {
          roomNoteId: note.id,
          propertyId: room.propertyId,
          roomId: room.id,
          contentLength: content.length,
        }),
      },
    });
    return note;
  });
}
