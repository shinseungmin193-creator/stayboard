"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireRoomAccess } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError } from "@/lib/prisma-errors";
import { changeRoomNoteStatusSchema, createRoomNoteSchema, openRoomInspectionSchema, roomNoteIdSchema, roomNoteRoomIdSchema, saveRoomNoteProcessingSchema, updateRoomNoteSchema } from "./room-note.schemas";
import { requireRoomNoteAccess } from "./server/room-note-access";
import { listOpenRoomNotesForRooms, listRoomInspectionNotes } from "./server/room-note.repository";
import { acknowledgeOpenRoomNotes, changeRoomNoteStatus, createManualRoomNote, deleteRoomNote, RoomNoteServiceError, saveRoomNoteProcessing, updateRoomNoteContent } from "./server/room-note.service";
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

export interface RoomInspectionData extends PendingRoomNotesData {
  acknowledgedCount: number;
}

function revalidateRoomNoteViews() {
  revalidatePath("/room-overview");
  revalidatePath("/cleaning");
}

export async function openRoomInspectionAction(input: unknown): Promise<ActionResult<RoomInspectionData>> {
  const t = await getTranslations("roomNotes");
  const parsed = openRoomInspectionSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid") };
  try {
    const context = await requireRoomAccess(parsed.data.roomId, PERMISSIONS.ROOM_NOTE_READ);
    const acknowledged = await acknowledgeOpenRoomNotes(context, parsed.data.roomId);
    const notes = await listRoomInspectionNotes(context, parsed.data.roomId, parsed.data.includeResolved);
    return { success: true, data: { roomId: parsed.data.roomId, notes, acknowledgedCount: acknowledged.count } };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    return actionFailureFromError(error, "openRoomInspection");
  }
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
    revalidateRoomNoteViews();
    return { success: true, data: note, message: t("messages.created") };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomNoteServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "createRoomNote");
  }
}

export async function createRoomNoteInlineAction(input: unknown): Promise<ActionResult<CreatedRoomNoteData>> {
  const t = await getTranslations("roomNotes");
  const parsed = createRoomNoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid"), fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const context = await requireRoomAccess(parsed.data.roomId, PERMISSIONS.ROOM_NOTE_CREATE);
    const note = await createManualRoomNote(context, parsed.data);
    revalidateRoomNoteViews();
    return { success: true, data: note, message: t("messages.created") };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomNoteServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "createRoomNoteInline");
  }
}

export async function updateRoomNoteAction(input: unknown): Promise<ActionResult<{ id: string; content: string }>> {
  const t = await getTranslations("roomNotes");
  const parsed = updateRoomNoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid"), fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const { context } = await requireRoomNoteAccess(parsed.data.id, PERMISSIONS.ROOM_NOTE_UPDATE);
    const updated = await updateRoomNoteContent(context, parsed.data.id, parsed.data.content);
    revalidateRoomNoteViews();
    return { success: true, data: { id: updated.id, content: updated.content ?? "" }, message: "메모를 수정했습니다." };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomNoteServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "updateRoomNote");
  }
}

export async function saveRoomNoteProcessingAction(input: unknown): Promise<ActionResult<{
  id: string;
  status: "OPEN" | "COMPLETED";
  resolutionNote: string;
  processedAt: string;
  processedByName: string | null;
  completedAt: string | null;
  completedByName: string | null;
}>> {
  const t = await getTranslations("roomNotes");
  const parsed = saveRoomNoteProcessingSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid"), fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const { context } = await requireRoomNoteAccess(parsed.data.id, PERMISSIONS.ROOM_NOTE_COMPLETE);
    const updated = await saveRoomNoteProcessing(context, parsed.data.id, parsed.data);
    revalidateRoomNoteViews();
    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        resolutionNote: updated.resolutionNote ?? "",
        processedAt: updated.processedAt!.toISOString(),
        processedByName: updated.processedByName,
        completedAt: updated.completedAt?.toISOString() ?? null,
        completedByName: updated.completedByName,
      },
      message: parsed.data.resolved ? "해결 처리했습니다." : "미해결 처리내용을 저장했습니다.",
    };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomNoteServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "saveRoomNoteProcessing");
  }
}

export async function changeRoomNoteStatusAction(input: unknown): Promise<ActionResult<ChangedRoomNoteStatusData>> {
  const t = await getTranslations("roomNotes");
  const parsed = changeRoomNoteStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("messages.invalid") };
  try {
    const { context } = await requireRoomNoteAccess(parsed.data.id, PERMISSIONS.ROOM_NOTE_COMPLETE);
    const updated = await changeRoomNoteStatus(context, parsed.data.id, parsed.data.status);
    revalidateRoomNoteViews();
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
    revalidateRoomNoteViews();
    return { success: true, data: deleted, message: t("messages.deleted") };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof RoomNoteServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "deleteRoomNote");
  }
}
