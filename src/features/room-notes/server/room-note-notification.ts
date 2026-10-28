import "server-only";

/**
 * Push delivery is intentionally abstracted from the room-note service. The
 * current PWA has install/offline support but no push subscription store yet,
 * so this event is the stable integration point for a future delivery adapter.
 */
export interface RoomNoteCreatedNotification {
  companyId: string;
  roomId: string;
  roomLabel: string;
  recipientRole: "STAFF";
  href: string;
  contentPreview: string;
}

export async function publishRoomNoteCreatedNotification(_event: RoomNoteCreatedNotification) {
  void _event;
  // No-op until a Web Push provider/subscription repository is configured.
}
