"use server";

import { revalidatePath } from "next/cache";
import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireCalendarSourceAccess, requireRoomAccess } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError, isPrismaUniqueError } from "@/lib/prisma-errors";
import type { CalendarConnectionResult } from "./calendar-source.types";
import { calendarSourceActiveSchema, calendarSourceIdSchema, calendarSourceInputSchema, calendarSourceUpdateSchema } from "./calendar-source.schemas";
import { CalendarSourceServiceError, changeCalendarSourceActive, createCalendarSourceSafely, testCalendarSourceConnection, updateCalendarSourceSafely } from "./calendar-source.service";

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
  const { id, calendarUrl, ...data } = parsed.data;
  try { await requireCalendarSourceAccess(id, PERMISSIONS.CALENDAR_SOURCE_MANAGE); await requireRoomAccess(data.roomId, PERMISSIONS.CALENDAR_SOURCE_MANAGE); await updateCalendarSourceSafely(id, { ...data, calendarUrl: calendarUrl || undefined }); revalidatePath("/calendar-sources"); return { success: true, message: "캘린더 연결을 수정했습니다." }; }
  catch (error) { return await serviceFailure(error, "updateCalendarSource"); }
}

export async function setCalendarSourceActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = calendarSourceActiveSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") });
  if (!parsed.success) return { success: false, message: "잘못된 상태 변경 요청입니다." };
  try { await requireCalendarSourceAccess(parsed.data.id, PERMISSIONS.CALENDAR_SOURCE_MANAGE); await changeCalendarSourceActive(parsed.data.id, parsed.data.isActive); revalidatePath("/calendar-sources"); return { success: true, message: parsed.data.isActive ? "캘린더 연결을 활성화했습니다." : "캘린더 연결을 비활성화했습니다. 기존 예약 데이터는 유지됩니다." }; }
  catch (error) { return await serviceFailure(error, "setCalendarSourceActive"); }
}

export async function testCalendarSourceAction(_state: ActionResult<CalendarConnectionResult>, formData: FormData): Promise<ActionResult<CalendarConnectionResult>> {
  const parsed = calendarSourceIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { success: false, message: "잘못된 연결 테스트 요청입니다." };
  try { await requireCalendarSourceAccess(parsed.data.id, PERMISSIONS.CALENDAR_SOURCE_MANAGE); const data = await testCalendarSourceConnection(parsed.data.id); return { success: true, data, message: "연결에 성공했습니다." }; }
  catch (error) { const failure = await serviceFailure(error, "testCalendarSource"); return failure.success ? { success: false, status: 500, errorCode: "UNKNOWN_ERROR", message: "연결 테스트에 실패했습니다." } : failure; }
}
