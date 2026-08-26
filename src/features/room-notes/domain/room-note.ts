import type { RoomNoteRoomOption, RoomNoteViewModel } from "../room-note.types";

export const ROOM_NOTE_SOURCE_TYPES = ["CLEANING", "MANUAL"] as const;
export type RoomNoteSourceType = (typeof ROOM_NOTE_SOURCE_TYPES)[number];
export const ROOM_NOTE_PAGE_SIZE = 20;

export function compareRoomNotesNewestFirst(left: RoomNoteViewModel, right: RoomNoteViewModel) {
  const dateOrder = right.createdAt.localeCompare(left.createdAt);
  return dateOrder || right.id.localeCompare(left.id);
}

/**
 * Both sources are already bounded to the requested page prefix in the
 * repository. De-duplicating by the source-qualified id makes cleaning note
 * retries and joins idempotent without copying CleaningTask.note.
 */
export function mergeRoomNotePage(
  manualNotes: readonly RoomNoteViewModel[],
  cleaningNotes: readonly RoomNoteViewModel[],
  page: number,
  pageSize = ROOM_NOTE_PAGE_SIZE,
) {
  const unique = new Map<string, RoomNoteViewModel>();
  for (const note of [...manualNotes, ...cleaningNotes]) unique.set(note.id, note);
  const sorted = [...unique.values()].sort(compareRoomNotesNewestFirst);
  const offset = (Math.max(1, page) - 1) * pageSize;
  return sorted.slice(offset, offset + pageSize);
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
