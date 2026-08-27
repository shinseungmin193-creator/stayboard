export const CLEANING_ROOM_NOTE_PREVIEW_LIMIT = 2;

export function getCleaningRoomNotePreview<T>(notes: readonly T[]) {
  const items = notes.slice(0, CLEANING_ROOM_NOTE_PREVIEW_LIMIT);
  return {
    items,
    totalCount: notes.length,
    remainingCount: Math.max(0, notes.length - items.length),
  };
}
