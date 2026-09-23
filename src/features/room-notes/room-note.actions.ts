"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireRoomAccess } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError } from "@/lib/prisma-errors";
import { changeRoomNoteStatusSchema, createRoomNoteSchema, roomNoteIdSchema, roomNoteRoomIdSchema } from "./room-note.schemas";
import { requireRoomNoteAccess } from "./server/room-note-access";
import { listOpenRoomNotesForRooms } from "./server/room-note.repository";
import { changeRoomNoteStatus, createManualRoomNote, deleteRoomNote, RoomNoteServiceError } from "./server/room-note.service";
import type { RoomNoteViewModel } from "./room-note.types";

export interface CreatedRoomNoteData { id: string }
export interface ChangedRoomNoteStatusData {
  id: string;
  status: "OPEN" | "COMPLETED";
  completedAt: string | null;
  completedByName: string | null;
}

export interface PendingRoomNotesData {
  roomId: string;
  notes: RoomNoteViewModel[];
}

export async function getPendingRoomNotesAction(input: unknown): Promise<ActionResult<PendingRoomNotesData>> {
  const t = await getTranslations("roomNotes");
  const parsed = roomNoteRoomIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid") };
  try {
    const context = await requireRoomAccess(parsed.data.roomId, PERMISSIONS.ROOM_NOTE_READ);
    const notes = await listOpenRoomNotesForRooms(context, [parsed.data.roomId]);
    return { success: true, data: { roomId: parsed.data.roomId, notes } };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    return actionFailureFromError(error, "getPendingRoomNotes");
  }
}

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

export async function changeRoomNoteStatusAction(input: unknown): Promise<ActionResult<ChangedRoomNoteStatusData>> {
  const t = await getTranslations("roomNotes");
  const parsed = changeRoomNoteStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid") };
  try {
    const { context } = await requireRoomNoteAccess(parsed.data.id, PERMISSIONS.ROOM_NOTE_COMPLETE);
    const updated = await changeRoomNoteStatus(context, parsed.data.id, parsed.data.status);
    revalidatePath("/room-notes");
    revalidatePath("/cleaning");
    revalidatePath("/room-overview");
    return {
      success: true,
      data: {
        ...updated,
        completedAt: updated.completedAt?.toISOString() ?? null,
      },
      message: t(parsed.data.status === "COMPLETED" ? "messages.completed" : "messages.reopened"),
    };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomNoteServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "changeRoomNoteStatus");
  }
}

export async function deleteRoomNoteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("roomNotes");
  const parsed = roomNoteIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid") };
  try {
    const { context } = await requireRoomNoteAccess(parsed.data.id, PERMISSIONS.ROOM_NOTE_DELETE);
    const deleted = await deleteRoomNote(context, parsed.data.id);
    revalidatePath("/room-notes");
    return { success: true, data: deleted, message: t("messages.deleted") };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomNoteServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "deleteRoomNote");
  }
}
