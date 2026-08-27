import "server-only";

import { canAccessCompany, canAccessRoom, PermissionDeniedError, withAccessAuditMetadata, type AccessContext } from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import type { RoomNoteStatus } from "../domain/room-note";

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
        sourceType: "MANUAL",
        status: "OPEN",
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

export async function changeRoomNoteStatus(context: AccessContext, roomNoteId: string, status: RoomNoteStatus) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.roomNote.findUnique({
      where: { id: roomNoteId },
      select: { id: true, companyId: true, propertyId: true, roomId: true, status: true },
    });
    if (!current) throw new RoomNoteServiceError("객실 메모를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId)) throw new PermissionDeniedError();
    if (current.status === status) {
      return tx.roomNote.findUniqueOrThrow({
        where: { id: roomNoteId },
        select: { id: true, status: true, completedAt: true, completedByName: true },
      });
    }

    const completed = status === "COMPLETED";
    const updated = await tx.roomNote.update({
      where: { id: roomNoteId },
      data: completed
        ? {
            status,
            completedAt: new Date(),
            completedByUserId: context.userId,
            completedByName: context.name?.trim() || "-",
          }
        : {
            status,
            completedAt: null,
            completedByUserId: null,
            completedByName: null,
          },
      select: { id: true, status: true, completedAt: true, completedByName: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: current.companyId,
        action: completed ? "ROOM_NOTE_COMPLETED" : "ROOM_NOTE_REOPENED",
        details: withAccessAuditMetadata(context, {
          roomNoteId,
          propertyId: current.propertyId,
          roomId: current.roomId,
          previousStatus: current.status,
          status,
        }),
      },
    });
    return updated;
  });
}

export async function deleteRoomNote(context: AccessContext, roomNoteId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.roomNote.findUnique({
      where: { id: roomNoteId },
      select: { id: true, companyId: true, propertyId: true, roomId: true, sourceType: true, cleaningTaskId: true },
    });
    if (!current) throw new RoomNoteServiceError("객실 메모를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId)) throw new PermissionDeniedError();

    // CLEANING 메모도 RoomNote 메타데이터만 삭제한다. CleaningTask/Log/Photo는 부모 원본으로 유지된다.
    await tx.roomNote.delete({ where: { id: roomNoteId } });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: current.companyId,
        action: "ROOM_NOTE_DELETED",
        details: withAccessAuditMetadata(context, {
          roomNoteId,
          propertyId: current.propertyId,
          roomId: current.roomId,
          sourceType: current.sourceType,
          cleaningTaskId: current.cleaningTaskId,
        }),
      },
    });
    return { id: roomNoteId };
  });
}
