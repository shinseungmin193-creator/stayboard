import type { RoomNoteRoomOption } from "../room-note.types";

export const ROOM_NOTE_SOURCE_TYPES = ["CLEANING", "MANUAL"] as const;
export type RoomNoteSourceType = (typeof ROOM_NOTE_SOURCE_TYPES)[number];
export const ROOM_NOTE_STATUSES = ["OPEN", "COMPLETED"] as const;
export type RoomNoteStatus = (typeof ROOM_NOTE_STATUSES)[number];
export type RoomNoteStatusFilter = RoomNoteStatus | null;
export const ROOM_NOTE_PAGE_SIZE = 20;

export function parseRoomNoteStatusFilter(value: string | null | undefined): RoomNoteStatusFilter {
  if (value?.toLowerCase() === "completed") return "COMPLETED";
  if (value?.toLowerCase() === "all") return null;
  return "OPEN";
}

export function serializeRoomNoteStatusFilter(status: RoomNoteStatusFilter) {
  if (status === null) return "all";
  return status.toLowerCase();
}

export function normalizeRoomNoteSelection(
  rooms: readonly Pick<RoomNoteRoomOption, "id" | "propertyId">[],
  requestedPropertyId: string | null,
  requestedRoomId: string | null,
) {
  const propertyIds = new Set(rooms.map((room) => room.propertyId));
  const propertyId = requestedPropertyId && propertyIds.has(requestedPropertyId) ? requestedPropertyId : null;
  const room = requestedRoomId
    ? rooms.find((candidate) => candidate.id === requestedRoomId && (!propertyId || candidate.propertyId === propertyId))
    : undefined;
  return { propertyId, roomId: room?.id ?? null };
}
