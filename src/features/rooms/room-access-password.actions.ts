"use server";

import {
  FORBIDDEN_ACTION_RESULT,
  isAccessControlError,
  PERMISSIONS,
  requireRoomAccess,
} from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError } from "@/lib/prisma-errors";
import { roomAccessPasswordReadSchema, roomAccessPasswordUpdateSchema } from "./room.schemas";
import {
  getRoomAccessPassword,
  RoomAccessPasswordServiceError,
  updateRoomAccessPassword,
} from "./server/room-access-password.service";

export async function getRoomAccessPasswordAction(input: unknown): Promise<ActionResult<{ password: string | null }>> {
  const parsed = roomAccessPasswordReadSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: "객실 정보를 확인해 주세요." };
  try {
    const context = await requireRoomAccess(parsed.data.roomId, PERMISSIONS.ROOM_ACCESS_PASSWORD_READ);
    return { success: true, data: await getRoomAccessPassword(context, parsed.data.roomId) };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomAccessPasswordServiceError) return { success: false, status: 404, errorCode: "NOT_FOUND", message: error.message };
    return actionFailureFromError(error, "getRoomAccessPassword");
  }
}

export async function updateRoomAccessPasswordAction(input: unknown): Promise<ActionResult<{ configured: boolean }>> {
  const parsed = roomAccessPasswordUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: "비밀번호를 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const context = await requireRoomAccess(parsed.data.roomId, PERMISSIONS.ROOM_ACCESS_PASSWORD_MANAGE);
    const data = await updateRoomAccessPassword(context, parsed.data.roomId, parsed.data.password);
    return { success: true, data, message: data.configured ? "비밀번호를 저장했습니다." : "비밀번호를 삭제했습니다." };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomAccessPasswordServiceError) return { success: false, status: 409, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "updateRoomAccessPassword");
  }
}
