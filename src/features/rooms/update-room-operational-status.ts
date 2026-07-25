import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";
import { ROOM_OPERATION_POLICY, shouldMarkCleaningRequired } from "./room-operational-status";

export type UpdateRoomOperationalStatusErrorCode = "ROOM_NOT_FOUND" | "UPDATE_FAILED";
export type UpdateRoomOperationalStatusResult = { success: true; roomId: string; operationalStatus: RoomOperationalStatus; updatedAt: string } | { success: false; code: UpdateRoomOperationalStatusErrorCode; message: string };
export const ROOM_OPERATIONAL_STATUS_ERRORS = { ROOM_NOT_FOUND: "객실을 찾을 수 없습니다.", UPDATE_FAILED: "운영 상태를 변경하지 못했습니다." } as const;

export async function updateRoomOperationalStatus(input: { roomId: string; operationalStatus: RoomOperationalStatus }, dependencies: { findRoom: (roomId: string) => Promise<{ id: string } | null>; updateStatus: (roomId: string, operationalStatus: RoomOperationalStatus, updatedAt: Date) => Promise<{ id: string; operationalStatus: RoomOperationalStatus; operationalStatusUpdatedAt: Date | null }> }, now = new Date()): Promise<UpdateRoomOperationalStatusResult> {
  const room = await dependencies.findRoom(input.roomId);
  if (!room) return { success: false, code: "ROOM_NOT_FOUND", message: ROOM_OPERATIONAL_STATUS_ERRORS.ROOM_NOT_FOUND };
  try { const updated = await dependencies.updateStatus(input.roomId, input.operationalStatus, now); return { success: true, roomId: updated.id, operationalStatus: updated.operationalStatus, updatedAt: (updated.operationalStatusUpdatedAt ?? now).toISOString() }; }
  catch { return { success: false, code: "UPDATE_FAILED", message: ROOM_OPERATIONAL_STATUS_ERRORS.UPDATE_FAILED }; }
}

export async function markCheckoutRoomsCleaningRequired(input: { candidates: Array<{ roomId: string; operationalStatus: RoomOperationalStatus; reservations: Array<{ status: string; startDate: Date; endDate: Date }> }>; todayStart: Date; todayEnd: Date }, updateStatus: (roomIds: string[], updatedAt: Date) => Promise<number>, now = new Date()) {
  if (!ROOM_OPERATION_POLICY.autoMarkCleaningRequired) return { enabled: false, updatedCount: 0 };
  const roomIds = input.candidates.filter((candidate) => shouldMarkCleaningRequired({ ...candidate, todayStart: input.todayStart, todayEnd: input.todayEnd })).map((candidate) => candidate.roomId);
  if (roomIds.length === 0) return { enabled: true, updatedCount: 0 };
  return { enabled: true, updatedCount: await updateStatus(roomIds, now) };
}
