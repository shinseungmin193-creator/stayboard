"use server";

import { revalidatePath } from "next/cache";
import { isAccessControlError, PERMISSIONS, requireRoomAccess } from "@/features/access-control";
import { logServerError } from "@/lib/prisma-errors";
import { findRoomForOperationalStatus, updateRoomOperationalStatusRecord } from "./room.repository";
import { roomOperationalStatusSchema } from "./room.schemas";
import { ROOM_OPERATIONAL_STATUS_ERRORS, updateRoomOperationalStatus, type UpdateRoomOperationalStatusResult } from "./update-room-operational-status";

export async function updateRoomOperationalStatusAction(input: { roomId: string; operationalStatus: string }): Promise<UpdateRoomOperationalStatusResult | { success: false; code: "INVALID_INPUT"; message: string }> {
  const parsed = roomOperationalStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, code: "INVALID_INPUT", message: "허용되지 않은 객실 운영 상태입니다." };
  try {
    await requireRoomAccess(parsed.data.roomId, PERMISSIONS.ROOM_OPERATIONAL_STATUS_UPDATE);
    const result = await updateRoomOperationalStatus(parsed.data, { findRoom: findRoomForOperationalStatus, updateStatus: updateRoomOperationalStatusRecord });
    if (result.success) revalidatePath("/room-overview");
    return result;
  } catch (error) {
    if (isAccessControlError(error)) return { success: false, code: "UPDATE_FAILED", message: "이 작업을 수행할 권한이 없습니다." };
    logServerError("updateRoomOperationalStatus", error);
    return { success: false, code: "UPDATE_FAILED", message: ROOM_OPERATIONAL_STATUS_ERRORS.UPDATE_FAILED };
  }
}
