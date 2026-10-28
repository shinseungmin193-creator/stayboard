import "server-only";

import { canAccessCompany, canAccessRoom, PermissionDeniedError, withAccessAuditMetadata, type AccessContext } from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import { withBasePath } from "@/lib/base-path";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import type { RoomNoteStatus } from "../domain/room-note";
import { publishRoomNoteCreatedNotification } from "./room-note-notification";

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
      name: true,
      isActive: true,
      property: { select: { companyId: true, name: true, isActive: true, company: { select: { isActive: true } } } },
    },
  });
  if (!room || room.propertyId !== input.propertyId) throw new RoomNoteServiceError("선택한 객실을 찾을 수 없습니다.");
  if (!canAccessCompany(context, room.property.companyId) || !canAccessRoom(context, room)) throw new PermissionDeniedError();
  if (!room.isActive || !room.property.isActive || !room.property.company.isActive) throw new RoomNoteServiceError("활성 상태인 객실에만 메모를 추가할 수 있습니다.");
  const authorName = context.name?.trim();
  if (!authorName) throw new RoomNoteServiceError("작성자 정보를 확인할 수 없습니다.");

  const note = await prisma.$transaction(async (tx) => {
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
  await publishRoomNoteCreatedNotification({
    companyId: room.property.companyId,
    roomId: room.id,
    roomLabel: `${room.property.name} ${room.name}`,
    recipientRole: "STAFF",
    href: withBasePath(`/room-overview?roomId=${encodeURIComponent(room.id)}&openMemo=true`),
    contentPreview: content.slice(0, 120),
  });
  return note;
}

export async function acknowledgeOpenRoomNotes(context: AccessContext, roomId: string) {
  if (context.role !== "STAFF") return { count: 0, noteIds: [] as string[] };
  const actorName = context.name?.trim() || "-";
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`room-note-ack:${roomId}`}))`;
    const notes = await tx.roomNote.findMany({
      where: { roomId, status: "OPEN", acknowledgedAt: null },
      select: { id: true, companyId: true, propertyId: true, roomId: true },
    });
    const accessible = notes.filter((note) => canAccessCompany(context, note.companyId) && canAccessRoom(context, note));
    if (!accessible.length) return { count: 0, noteIds: [] as string[] };
    const noteIds = accessible.map((note) => note.id);
    const acknowledgedAt = new Date();
    const updated = await tx.roomNote.updateMany({
      where: { id: { in: noteIds }, status: "OPEN", acknowledgedAt: null },
      data: {
        acknowledgedAt,
        acknowledgedById: context.userId,
        acknowledgedByName: actorName,
      },
    });
    if (!updated.count) return { count: 0, noteIds: [] as string[] };
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: accessible[0].companyId,
        action: "ROOM_NOTES_ACKNOWLEDGED",
        details: withAccessAuditMetadata(context, { roomId, roomNoteIds: noteIds, count: updated.count }),
      },
    });
    return { count: updated.count, noteIds };
  });
}

export async function updateRoomNoteContent(context: AccessContext, roomNoteId: string, contentInput: string) {
  const content = contentInput.trim();
  if (!content || content.length > 1000) throw new RoomNoteServiceError("메모 내용을 확인해 주세요.");
  return prisma.$transaction(async (tx) => {
    const current = await tx.roomNote.findUnique({
      where: { id: roomNoteId },
      select: { id: true, companyId: true, propertyId: true, roomId: true, sourceType: true },
    });
    if (!current) throw new RoomNoteServiceError("객실 메모를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId) || !canAccessRoom(context, current)) throw new PermissionDeniedError();
    if (current.sourceType !== "MANUAL") throw new RoomNoteServiceError("청소에서 생성된 메모 원문은 청소 관리에서 수정해 주세요.");
    const updated = await tx.roomNote.update({ where: { id: roomNoteId }, data: { content }, select: { id: true, content: true, updatedAt: true } });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: current.companyId,
        action: "ROOM_NOTE_UPDATED",
        details: withAccessAuditMetadata(context, { roomNoteId, propertyId: current.propertyId, roomId: current.roomId, contentLength: content.length }),
      },
    });
    return updated;
  });
}

export async function saveRoomNoteProcessing(context: AccessContext, roomNoteId: string, input: { resolutionNote: string; resolved: boolean }) {
  const resolutionNote = input.resolutionNote.trim();
  if (resolutionNote.length > 2000) throw new RoomNoteServiceError("처리내용은 2,000자 이하로 입력해 주세요.");
  const actorName = context.name?.trim() || "-";
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`room-note-process:${roomNoteId}`}))`;
    const current = await tx.roomNote.findUnique({
      where: { id: roomNoteId },
      select: { id: true, companyId: true, propertyId: true, roomId: true, status: true },
    });
    if (!current) throw new RoomNoteServiceError("객실 메모를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId) || !canAccessRoom(context, current)) throw new PermissionDeniedError();
    if (current.status !== "OPEN") throw new RoomNoteServiceError("이미 해결된 객실 메모입니다.");
    const now = new Date();
    const updated = await tx.roomNote.update({
      where: { id: roomNoteId },
      data: {
        resolutionNote: resolutionNote || null,
        processedAt: now,
        processedById: context.userId,
        processedByName: actorName,
        ...(input.resolved ? {
          status: "COMPLETED" as const,
          completedAt: now,
          completedByUserId: context.userId,
          completedByName: actorName,
        } : {}),
      },
      select: {
        id: true,
        status: true,
        resolutionNote: true,
        processedAt: true,
        processedByName: true,
        completedAt: true,
        completedByName: true,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: current.companyId,
        action: input.resolved ? "ROOM_NOTE_COMPLETED" : "ROOM_NOTE_PROCESSING_SAVED",
        details: withAccessAuditMetadata(context, {
          roomNoteId,
          propertyId: current.propertyId,
          roomId: current.roomId,
          previousStatus: current.status,
          status: updated.status,
          resolutionNoteLength: resolutionNote.length,
        }),
      },
    });
    return updated;
  });
}

export async function changeRoomNoteStatus(context: AccessContext, roomNoteId: string, status: RoomNoteStatus) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.roomNote.findUnique({
      where: { id: roomNoteId },
      select: { id: true, companyId: true, propertyId: true, roomId: true, status: true },
    });
    if (!current) throw new RoomNoteServiceError("객실 메모를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId) || !canAccessRoom(context, current)) throw new PermissionDeniedError();
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
  const deleted = await prisma.$transaction(async (tx) => {
    const current = await tx.roomNote.findUnique({
      where: { id: roomNoteId },
      select: { id: true, companyId: true, propertyId: true, roomId: true, sourceType: true, cleaningTaskId: true, photos: { select: { storageKey: true } } },
    });
    if (!current) throw new RoomNoteServiceError("객실 메모를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId) || !canAccessRoom(context, current)) throw new PermissionDeniedError();

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
    return { id: roomNoteId, storageKeys: current.photos.map((photo) => photo.storageKey) };
  });
  const storage = getCleaningPhotoStorage();
  await Promise.allSettled(deleted.storageKeys.map((storageKey) => storage.delete(storageKey)));
  return { id: deleted.id };
}
