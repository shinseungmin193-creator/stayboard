import "server-only";

import { companyScopeIds, roomScopeWhere, type AccessContext } from "@/features/access-control";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getZonedDateInput } from "@/lib/zoned-date";
import { mergeRoomNotePage, ROOM_NOTE_PAGE_SIZE } from "../domain/room-note";
import type { RoomNoteFilters, RoomNoteOptions, RoomNotePageResult, RoomNoteViewModel } from "../room-note.types";

function roomRelationWhere(context: AccessContext, filters: RoomNoteFilters): Prisma.RoomWhereInput {
  return {
    ...(roomScopeWhere(context.scope) ?? {}),
    ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    ...(filters.roomId ? { id: filters.roomId } : {}),
  };
}

function searchContains(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

export async function listRoomNoteOptions(context: AccessContext): Promise<RoomNoteOptions> {
  const companyIds = companyScopeIds(context);
  const rooms = await prisma.room.findMany({
    where: {
      ...(roomScopeWhere(context.scope) ?? {}),
      ...(companyIds ? { property: { companyId: { in: [...companyIds] } } } : {}),
    },
    select: {
      id: true,
      name: true,
      propertyId: true,
      isActive: true,
      property: { select: { id: true, name: true, isActive: true, company: { select: { isActive: true } } } },
    },
    orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const properties = new Map<string, RoomNoteOptions["properties"][number]>();
  for (const room of rooms) {
    properties.set(room.property.id, {
      id: room.property.id,
      name: room.property.name,
      isActive: room.property.isActive && room.property.company.isActive,
    });
  }
  return {
    properties: [...properties.values()],
    rooms: rooms.map((room) => ({
      id: room.id,
      propertyId: room.propertyId,
      propertyName: room.property.name,
      name: formatRoomDisplayName(room),
      isActive: room.isActive && room.property.isActive && room.property.company.isActive,
    })),
  };
}

export async function listRoomNotes(context: AccessContext, filters: RoomNoteFilters): Promise<RoomNotePageResult> {
  const scopedRoom = roomRelationWhere(context, filters);
  const query = filters.query.trim().slice(0, 100);
  const text = query ? searchContains(query) : null;
  const manualWhere: Prisma.RoomNoteWhereInput = {
    room: { is: scopedRoom },
    ...(text ? { OR: [
      { content: text },
      { authorName: text },
      { room: { is: { name: text } } },
      { property: { is: { name: text } } },
    ] } : {}),
  };
  const cleaningWhere: Prisma.CleaningTaskWhereInput = {
    status: "COMPLETED",
    AND: [{ note: { not: null } }, { note: { not: "" } }],
    room: { is: scopedRoom },
    ...(text ? { OR: [
      { note: text },
      { completedByName: text },
      { completedBy: { is: { name: text } } },
      { room: { is: { name: text } } },
      { property: { is: { name: text } } },
      { logs: { some: { action: "NOTE_ADDED", actor: { is: { name: text } } } } },
    ] } : {}),
  };

  const [manualCount, cleaningCount] = await Promise.all([
    prisma.roomNote.count({ where: manualWhere }),
    prisma.cleaningTask.count({ where: cleaningWhere }),
  ]);
  const totalCount = manualCount + cleaningCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / ROOM_NOTE_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), totalPages);
  const candidateTake = page * ROOM_NOTE_PAGE_SIZE;
  const [manualRows, cleaningRows] = await Promise.all([
    prisma.roomNote.findMany({
      where: manualWhere,
      select: {
        id: true,
        content: true,
        authorName: true,
        createdAt: true,
        propertyId: true,
        roomId: true,
        property: { select: { name: true, timezone: true } },
        room: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: candidateTake,
    }),
    prisma.cleaningTask.findMany({
      where: cleaningWhere,
      select: {
        id: true,
        note: true,
        completedAt: true,
        completedByName: true,
        updatedAt: true,
        propertyId: true,
        roomId: true,
        property: { select: { name: true, timezone: true } },
        room: { select: { name: true } },
        completedBy: { select: { name: true } },
        logs: {
          where: { action: "NOTE_ADDED" },
          select: { id: true, createdAt: true, actor: { select: { name: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
        photos: {
          where: { storageKey: { not: null }, deletedAt: null },
          select: { id: true, storageKey: true, originalName: true, mimeType: true, size: true, createdAt: true, deleteAfter: true, deletedAt: true },
          orderBy: { createdAt: "asc" },
          take: 12,
        },
        _count: { select: { photos: { where: { storageKey: { not: null }, deletedAt: null } } } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: candidateTake,
    }),
  ]);

  const manualNotes: RoomNoteViewModel[] = manualRows.map((note) => ({
    id: `MANUAL:${note.id}`,
    sourceType: "MANUAL",
    sourceId: note.id,
    propertyId: note.propertyId,
    propertyName: note.property.name,
    propertyTimeZone: note.property.timezone,
    roomId: note.roomId,
    roomName: formatRoomDisplayName(note.room),
    content: note.content,
    authorName: note.authorName,
    createdAt: note.createdAt.toISOString(),
    cleaningTaskId: null,
    cleaningDate: null,
    photoCount: 0,
    photos: [],
  }));
  const storage = getCleaningPhotoStorage();
  const cleaningNotes: RoomNoteViewModel[] = cleaningRows.flatMap((task) => {
    const content = task.note?.trim();
    if (!content) return [];
    const noteLog = task.logs[0];
    return [{
      id: `CLEANING:${task.id}`,
      sourceType: "CLEANING" as const,
      sourceId: task.id,
      propertyId: task.propertyId,
      propertyName: task.property.name,
      propertyTimeZone: task.property.timezone,
      roomId: task.roomId,
      roomName: formatRoomDisplayName(task.room),
      content,
      authorName: noteLog?.actor?.name ?? task.completedByName ?? task.completedBy?.name ?? "-",
      createdAt: (noteLog?.createdAt ?? task.completedAt ?? task.updatedAt).toISOString(),
      cleaningTaskId: task.id,
      cleaningDate: getZonedDateInput(task.completedAt ?? task.updatedAt, task.property.timezone),
      photoCount: task._count.photos,
      photos: task.photos.map((photo) => ({
        id: photo.id,
        url: photo.storageKey ? storage.getUrl(photo.id) : null,
        originalName: photo.originalName,
        mimeType: photo.mimeType,
        size: photo.size,
        createdAt: photo.createdAt.toISOString(),
        deleteAfter: photo.deleteAfter?.toISOString() ?? null,
        deletedAt: photo.deletedAt?.toISOString() ?? null,
      })),
    }];
  });

  return {
    items: mergeRoomNotePage(manualNotes, cleaningNotes, page),
    page,
    pageSize: ROOM_NOTE_PAGE_SIZE,
    totalCount,
    totalPages,
  };
}
