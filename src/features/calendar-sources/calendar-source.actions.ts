"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireCalendarSourceAccess, requireRoomAccess } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError, isPrismaUniqueError } from "@/lib/prisma-errors";
import { syncCalendarSource } from "@/features/calendar-sync/application/sync-calendar-source";
import type { CalendarConnectionResult, CalendarSourceDeleteImpact, CalendarSourceDeleteResult } from "./calendar-source.types";
import { calendarSourceActiveSchema, calendarSourceDeleteImpactSchema, calendarSourceDeleteSchema, calendarSourceIdSchema, calendarSourceInputSchema, calendarSourceUpdateSchema, calendarSourceUrlReplacementSchema } from "./calendar-source.schemas";
import { CalendarSourceServiceError, changeCalendarSourceActive, createCalendarSourceSafely, deleteCalendarSourceSafely, getCalendarSourceDeleteImpact, getCalendarSourceDeleteTarget, replaceCalendarSourceUrlSafely, testCalendarSourceConnection, updateCalendarSourceSafely } from "./calendar-source.service";

function fields(formData: FormData) { return { roomId: formData.get("roomId"), provider: formData.get("provider"), name: formData.get("name"), calendarUrl: formData.get("calendarUrl"), isActive: formData.get("isActive") ?? "false" }; }
async function serviceFailure(error: unknown, context: string): Promise<ActionResult> { if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT; if (error instanceof CalendarSourceServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message }; if (isPrismaUniqueError(error)) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: "같은 객실에 동일한 ICS URL이 이미 등록되어 있습니다." }; return actionFailureFromError(error, context); }

export async function createCalendarSourceAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = calendarSourceInputSchema.safeParse(fields(formData));
  if (!parsed.success) return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  try { await requireRoomAccess(parsed.data.roomId, PERMISSIONS.CALENDAR_SOURCE_MANAGE); await createCalendarSourceSafely(parsed.data); revalidatePath("/calendar-sources"); revalidatePath("/rooms"); return { success: true, message: "캘린더 연결을 등록했습니다." }; }
  catch (error) { return await serviceFailure(error, "createCalendarSource"); }
}

export async function updateCalendarSourceAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = calendarSourceUpdateSchema.safeParse({ id: formData.get("id"), ...fields(formData) });
  if (!parsed.success) return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { id, ...data } = parsed.data;
  try { await requireCalendarSourceAccess(id, PERMISSIONS.CALENDAR_SOURCE_MANAGE); await requireRoomAccess(data.roomId, PERMISSIONS.CALENDAR_SOURCE_MANAGE); await updateCalendarSourceSafely(id, data); revalidatePath("/calendar-sources"); return { success: true, message: "캘린더 연결을 수정했습니다." }; }
  catch (error) { return await serviceFailure(error, "updateCalendarSource"); }
}

export async function replaceCalendarSourceUrlAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = calendarSourceUrlReplacementSchema.safeParse({ calendarSourceId: formData.get("calendarSourceId"), calendarUrl: formData.get("calendarUrl") });
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: "최신 ICS URL을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const context = await requireCalendarSourceAccess(parsed.data.calendarSourceId, PERMISSIONS.CALENDAR_SOURCE_MANAGE);
    await replaceCalendarSourceUrlSafely({ ...parsed.data, context });
    let message = "iCal URL을 안전하게 교체하고 동기화를 완료했습니다.";
    try {
      await syncCalendarSource(parsed.data.calendarSourceId);
    } catch (error) {
      message = `iCal URL은 교체했지만 첫 동기화를 완료하지 못했습니다. ${error instanceof Error ? error.message : "다시 동기화해 주세요."}`;
    }
    revalidatePath("/calendar-sources");
    revalidatePath("/rooms");
    revalidatePath("/reservations");
    revalidatePath("/room-overview");
    revalidatePath("/room-status");
    revalidatePath("/dashboard");
    revalidatePath(`/calendar-sources/${parsed.data.calendarSourceId}/sync-logs`);
    return { success: true, message };
  } catch (error) {
    return await serviceFailure(error, "replaceCalendarSourceUrl");
  }
}

async function applyCalendarSourceActiveChange(id: string, isActive: boolean): Promise<ActionResult> {
  const t = await getTranslations("calendarSourceDeletion");
  try {
    await requireCalendarSourceAccess(id, PERMISSIONS.CALENDAR_SOURCE_MANAGE);
    await changeCalendarSourceActive(id, isActive);
    revalidatePath("/calendar-sources");
    revalidatePath("/rooms");
    revalidatePath("/room-overview");
    revalidatePath("/room-status");
    return { success: true, message: isActive ? t("activeChange.activated") : t("activeChange.deactivated") };
  } catch (error) {
    return await serviceFailure(error, "setCalendarSourceActive");
  }
}

export async function setCalendarSourceActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = calendarSourceActiveSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") });
  if (!parsed.success) return { success: false, message: "잘못된 상태 변경 요청입니다." };
  return applyCalendarSourceActiveChange(parsed.data.id, parsed.data.isActive);
}

export async function changeCalendarSourceActiveAction(input: { id: string; isActive: boolean }): Promise<ActionResult> {
  const parsed = calendarSourceActiveSchema.safeParse({ id: input.id, isActive: String(input.isActive) });
  if (!parsed.success) return { success: false, message: "잘못된 상태 변경 요청입니다." };
  return applyCalendarSourceActiveChange(parsed.data.id, parsed.data.isActive);
}

export async function testCalendarSourceAction(_state: ActionResult<CalendarConnectionResult>, formData: FormData): Promise<ActionResult<CalendarConnectionResult>> {
  const parsed = calendarSourceIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { success: false, message: "잘못된 연결 테스트 요청입니다." };
  try { await requireCalendarSourceAccess(parsed.data.id, PERMISSIONS.CALENDAR_SOURCE_MANAGE); const data = await testCalendarSourceConnection(parsed.data.id); return { success: true, data, message: "연결에 성공했습니다." }; }
  catch (error) { const failure = await serviceFailure(error, "testCalendarSource"); return failure.success ? { success: false, status: 500, errorCode: "UNKNOWN_ERROR", message: "연결 테스트에 실패했습니다." } : failure; }
}

async function calendarSourceDeletionFailure<T>(error: unknown, context: string): Promise<ActionResult<T>> {
  const t = await getTranslations("calendarSourceDeletion");
  if (isAccessControlError(error)) return { ...FORBIDDEN_ACTION_RESULT, message: t("errors.forbidden") };
  if (error instanceof CalendarSourceServiceError) {
    if (error.code === "SYNC_IN_PROGRESS") return { success: false, status: 409, errorCode: "SYNC_FAILED", message: t("errors.syncing") };
    if (error.code === "NOT_FOUND") return { success: false, status: 404, errorCode: "NOT_FOUND", message: t("errors.notFound") };
    if (error.code === "CONFIRMATION_MISMATCH") return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("errors.confirmation") };
    if (error.code === "SCOPE_CHANGED") return { success: false, status: 409, errorCode: "VALIDATION_ERROR", message: t("errors.scopeChanged") };
  }
  const failure = await actionFailureFromError(error, context);
  return { ...failure, message: t("errors.failed") };
}

export async function getCalendarSourceDeleteImpactAction(calendarSourceId: string): Promise<ActionResult<CalendarSourceDeleteImpact>> {
  const parsed = calendarSourceDeleteImpactSchema.safeParse({ calendarSourceId });
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: (await getTranslations("calendarSourceDeletion"))("errors.invalidRequest") };
  try {
    await requireCalendarSourceAccess(parsed.data.calendarSourceId, PERMISSIONS.CALENDAR_SOURCE_MANAGE);
    const target = await getCalendarSourceDeleteTarget(parsed.data.calendarSourceId);
    await requireRoomAccess(target.roomId, PERMISSIONS.CALENDAR_SOURCE_MANAGE);
    return { success: true, data: await getCalendarSourceDeleteImpact(target.id) };
  } catch (error) {
    return calendarSourceDeletionFailure<CalendarSourceDeleteImpact>(error, "getCalendarSourceDeleteImpact");
  }
}

export async function deleteCalendarSourceAction(input: {
  calendarSourceId: string;
  confirmationText: string;
}): Promise<ActionResult<CalendarSourceDeleteResult>> {
  const parsed = calendarSourceDeleteSchema.safeParse(input);
  const t = await getTranslations("calendarSourceDeletion");
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("errors.invalidRequest") };
  try {
    await requireCalendarSourceAccess(parsed.data.calendarSourceId, PERMISSIONS.CALENDAR_SOURCE_MANAGE);
    const target = await getCalendarSourceDeleteTarget(parsed.data.calendarSourceId);
    const context = await requireRoomAccess(target.roomId, PERMISSIONS.CALENDAR_SOURCE_MANAGE);
    const data = await deleteCalendarSourceSafely({ target, confirmationText: parsed.data.confirmationText, context });
    revalidatePath("/calendar-sources");
    revalidatePath("/rooms");
    revalidatePath("/reservations");
    revalidatePath("/room-overview");
    revalidatePath("/room-status");
    revalidatePath("/dashboard");
    return { success: true, data, message: t("successWithCount", { sourceName: data.sourceName, count: data.reservationCount }) };
  } catch (error) {
    return calendarSourceDeletionFailure<CalendarSourceDeleteResult>(error, "deleteCalendarSource");
  }
}
