import "server-only";

import { canAccessRoom, companyScopeIds, type AccessContext } from "@/features/access-control";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getZonedDateInput } from "@/lib/zoned-date";
import { OPEN_ROOM_NOTE_STATUS, ROOM_NOTE_PAGE_SIZE } from "../domain/room-note";
import type { RoomNoteFilters, RoomNoteOptions, RoomNotePageResult, RoomNoteViewModel } from "../room-note.types";

const roomNoteViewSelect = {
  id: true,
  sourceType: true,
  status: true,
  content: true,
  authorName: true,
  createdAt: true,
  completedAt: true,
  completedByName: true,
  propertyId: true,
  roomId: true,
  cleaningTaskId: true,
  property: { select: { name: true, timezone: true } },
  room: { select: { name: true } },
  cleaningTask: {
    select: {
      note: true,
      completedAt: true,
      updatedAt: true,
      photos: {
        where: { storageKey: { not: null }, deletedAt: null },
        select: { id: true, storageKey: true, originalName: true, mimeType: true, size: true, createdAt: true, deleteAfter: true, deletedAt: true },
        orderBy: { createdAt: "asc" },
        take: 12,
      },
      _count: { select: { photos: { where: { storageKey: { not: null }, deletedAt: null } } } },
    },
  },
} satisfies Prisma.RoomNoteSelect;

type RoomNoteViewRow = Prisma.RoomNoteGetPayload<{ select: typeof roomNoteViewSelect }>;

function companyWhere(context: AccessContext): Prisma.RoomNoteWhereInput {
  const companyIds = companyScopeIds(context);
  return companyIds ? { companyId: { in: [...companyIds] } } : {};
}

function searchContains(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

function toRoomNoteViewModel(note: RoomNoteViewRow): RoomNoteViewModel {
  const task = note.cleaningTask;
  const storage = getCleaningPhotoStorage();
  return {
    id: note.id,
    sourceType: note.sourceType,
    sourceId: note.id,
    status: note.status,
    propertyId: note.propertyId,
    propertyName: note.property.name,
    propertyTimeZone: note.property.timezone,
    roomId: note.roomId,
    roomName: formatRoomDisplayName(note.room),
    content: (note.sourceType === "CLEANING" ? task?.note : note.content)?.trim() ?? "",
    authorName: note.authorName,
    createdAt: note.createdAt.toISOString(),
    completedAt: note.completedAt?.toISOString() ?? null,
    completedByName: note.completedByName,
    cleaningTaskId: note.cleaningTaskId,
    cleaningDate: task ? getZonedDateInput(task.completedAt ?? task.updatedAt, note.property.timezone) : null,
    photoCount: task?._count.photos ?? 0,
    photos: (task?.photos ?? []).map((photo) => ({
      id: photo.id,
      url: photo.storageKey ? storage.getUrl(photo.id) : null,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
      size: photo.size,
      createdAt: photo.createdAt.toISOString(),
      deleteAfter: photo.deleteAfter?.toISOString() ?? null,
      deletedAt: photo.deletedAt?.toISOString() ?? null,
    })),
  };
}

export async function listRoomNoteOptions(context: AccessContext): Promise<RoomNoteOptions> {
  const companyIds = companyScopeIds(context);
  const rooms = await prisma.room.findMany({
    where: {
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
      canCreate: canAccessRoom(context, room),
    })),
  };
}

export async function listRoomNotes(context: AccessContext, filters: RoomNoteFilters): Promise<RoomNotePageResult> {
  const query = filters.query.trim().slice(0, 100);
  const text = query ? searchContains(query) : null;
  const where: Prisma.RoomNoteWhereInput = {
    ...companyWhere(context),
    ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    ...(filters.roomId ? { roomId: filters.roomId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(text ? {
      OR: [
        { content: text },
        { authorName: text },
        { completedByName: text },
        { cleaningTask: { is: { note: text } } },
        { room: { is: { name: text } } },
        { property: { is: { name: text } } },
      ],
    } : {}),
  };

  const totalCount = await prisma.roomNote.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / ROOM_NOTE_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), totalPages);
  const rows = await prisma.roomNote.findMany({
    where,
    select: roomNoteViewSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ROOM_NOTE_PAGE_SIZE,
    take: ROOM_NOTE_PAGE_SIZE,
  });

  const items = rows.map(toRoomNoteViewModel);

  return {
    items,
    page,
    pageSize: ROOM_NOTE_PAGE_SIZE,
    totalCount,
    totalPages,
  };
}

/** One query for every visible cleaning card; never query once per room/task. */
export async function listOpenRoomNotesForRooms(context: AccessContext, roomIds: readonly string[]): Promise<RoomNoteViewModel[]> {
  const uniqueRoomIds = [...new Set(roomIds.filter(Boolean))];
  if (!uniqueRoomIds.length) return [];
  const rows = await prisma.roomNote.findMany({
    where: {
      ...companyWhere(context),
      roomId: { in: uniqueRoomIds },
      status: OPEN_ROOM_NOTE_STATUS,
    },
    select: roomNoteViewSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toRoomNoteViewModel);
}
