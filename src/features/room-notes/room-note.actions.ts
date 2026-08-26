"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireRoomAccess } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError } from "@/lib/prisma-errors";
import { createRoomNoteSchema } from "./room-note.schemas";
import { createManualRoomNote, RoomNoteServiceError } from "./server/room-note.service";

export interface CreatedRoomNoteData { id: string }

export async function createRoomNoteAction(
  _state: ActionResult<CreatedRoomNoteData>,
  formData: FormData,
): Promise<ActionResult<CreatedRoomNoteData>> {
  const t = await getTranslations("roomNotes");
  const parsed = createRoomNoteSchema.safeParse({
    propertyId: formData.get("propertyId"),
    roomId: formData.get("roomId"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid"), fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const context = await requireRoomAccess(parsed.data.roomId, PERMISSIONS.ROOM_NOTE_CREATE);
    const note = await createManualRoomNote(context, parsed.data);
    revalidatePath("/room-notes");
    return { success: true, data: note, message: t("messages.created") };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomNoteServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "createRoomNote");
  }
}
