"use server";

import { revalidatePath } from "next/cache";
import { authorizeAccess, companyScopeIds, FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireCalendarSourceAccess, requirePropertyAccess, requireRoomAccess } from "@/features/access-control";
import { listActiveCalendarSourceIdsForOverview, listActiveCalendarSourceIdsForRooms, listActiveCalendarSourceIdsForSync } from "@/features/calendar-sources";
import type { ActionResult } from "@/lib/action-result";
import { logServerError } from "@/lib/prisma-errors";
import { syncCalendarSources, type BulkCalendarSyncResult } from "./application/sync-calendar-sources";
import { syncCalendarSource } from "./application/sync-calendar-source";
import { CALENDAR_SYNC_BULK_MAX_SOURCES } from "./calendar-sync.constants";
import { bulkSyncCalendarSourcesSchema, roomOverviewSyncSchema, syncCalendarSourceSchema } from "./calendar-sync.schemas";
import { summarizeError } from "./domain/sync-error";
import type { CalendarSyncResult } from "./domain/sync-result";
import { findCalendarSourceForSync } from "./infrastructure/reservation-sync.repository";
import { createSyncRun, finishSyncRun } from "./infrastructure/sync-run.repository";

export type BulkSyncResult = BulkCalendarSyncResult;

function revalidateSyncViews() {
  revalidatePath("/calendar-sources");
  revalidatePath("/reservations");
  revalidatePath("/reservation-conflicts");
  revalidatePath("/room-overview");
  revalidatePath("/");
}

function accessFailure(reason: "UNAUTHENTICATED" | "FORBIDDEN" | "COMPANY_SCOPE"): ActionResult<never> {
  if (reason === "UNAUTHENTICATED") return { success: false, status: 401, errorCode: "UNAUTHORIZED", message: "로그인이 필요합니다." };
  return FORBIDDEN_ACTION_RESULT;
}

function tooManySources(): ActionResult<never> {
  return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: `동기화 대상이 ${CALENDAR_SYNC_BULK_MAX_SOURCES}개를 초과합니다. 범위를 줄여 주세요.` };
}

export async function syncCalendarSourceAction(_state: ActionResult<CalendarSyncResult>, formData: FormData): Promise<ActionResult<CalendarSyncResult>> {
  const parsed = syncCalendarSourceSchema.safeParse({ calendarSourceId: formData.get("calendarSourceId") });
  if (!parsed.success) return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: "잘못된 동기화 요청입니다." };
  try {
    const context = await requireCalendarSourceAccess(parsed.data.calendarSourceId, PERMISSIONS.SYNC_RUN);
    const source = await findCalendarSourceForSync(parsed.data.calendarSourceId);
    if (!source) return { success: false, status: 400, errorCode: "NOT_FOUND", message: "CalendarSource를 찾을 수 없습니다." };
    const startedAt = new Date();
    const run = await createSyncRun({ roomId: source.roomId, actorUserId: context.userId, executionMode: "MANUAL", targetCount: 1, startedAt });
    let data: CalendarSyncResult;
    try {
      data = await syncCalendarSource(parsed.data.calendarSourceId, undefined, run.id);
      await finishSyncRun(run.id, { successCount: 1, failedCount: 0, errorSummary: null, finishedAt: new Date() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "동기화에 실패했습니다.";
      await finishSyncRun(run.id, { successCount: 0, failedCount: 1, errorSummary: summarizeError(message), finishedAt: new Date() });
      throw error;
    }
    revalidateSyncViews();
    return { success: true, data, message: "예약 동기화를 완료했습니다." };
  } catch (error) {
    if (isAccessControlError(error)) return accessFailure("reason" in error ? error.reason : "FORBIDDEN");
    if (error instanceof Error && (error.name === "CalendarSyncError" || error.name === "CalendarSyncAlreadyRunningError")) return { success: false, message: error.message };
    logServerError("syncCalendarSource", error);
    return { success: false, message: "예약 동기화에 실패했습니다." };
  }
}

export async function syncFilteredCalendarSourcesAction(_state: ActionResult<BulkSyncResult>, formData: FormData): Promise<ActionResult<BulkSyncResult>> {
  const parsed = bulkSyncCalendarSourcesSchema.safeParse({ propertyId: formData.get("propertyId"), roomId: formData.get("roomId"), provider: formData.get("provider") });
  if (!parsed.success) return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: "동기화 필터가 올바르지 않습니다." };
  const access = await authorizeAccess(PERMISSIONS.SYNC_RUN);
  if (!access.allowed) return accessFailure(access.reason);
  try {
    if (parsed.data.propertyId) await requirePropertyAccess(parsed.data.propertyId, PERMISSIONS.SYNC_RUN);
    if (parsed.data.roomId) await requireRoomAccess(parsed.data.roomId, PERMISSIONS.SYNC_RUN);
  } catch (error) {
    if (isAccessControlError(error)) return accessFailure(error instanceof Error && "reason" in error ? error.reason as "UNAUTHENTICATED" | "FORBIDDEN" | "COMPANY_SCOPE" : "FORBIDDEN");
    throw error;
  }
  const sources = await listActiveCalendarSourceIdsForSync({ ...parsed.data, companyIds: companyScopeIds(access.context) }, CALENDAR_SYNC_BULK_MAX_SOURCES + 1, access.context.scope);
  if (sources.length > CALENDAR_SYNC_BULK_MAX_SOURCES) return tooManySources();
  const data = await syncCalendarSources(sources, "syncFilteredCalendarSources", access.context.userId);
  revalidateSyncViews();
  return { success: true, data, message: data.targetCount ? "필터 대상 동기화를 완료했습니다." : "동기화할 활성 캘린더 연결이 없습니다." };
}

export async function syncRoomCalendarSourcesAction(_state: ActionResult<BulkSyncResult>, formData: FormData): Promise<ActionResult<BulkSyncResult>> {
  const roomIds = [...new Set(formData.getAll("roomIds").flatMap((value) => typeof value === "string" && value.trim() ? [value.trim()] : []))];
  if (!roomIds.length) return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: "동기화할 객실을 선택해 주세요." };
  const access = await authorizeAccess(PERMISSIONS.SYNC_RUN);
  if (!access.allowed) return accessFailure(access.reason);
  try {
    for (const roomId of roomIds) await requireRoomAccess(roomId, PERMISSIONS.SYNC_RUN);
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    throw error;
  }
  const sources = await listActiveCalendarSourceIdsForRooms(roomIds, CALENDAR_SYNC_BULK_MAX_SOURCES + 1, companyScopeIds(access.context));
  if (sources.length > CALENDAR_SYNC_BULK_MAX_SOURCES) return tooManySources();
  const data = await syncCalendarSources(sources, "syncRoomCalendarSources", access.context.userId);
  revalidateSyncViews();
  return { success: true, data, message: data.targetCount ? "선택한 객실의 활성 연결 동기화를 완료했습니다." : "동기화할 활성 캘린더 연결이 없습니다." };
}

export async function syncRoomOverviewCalendarSourcesAction(input: { propertyId?: string }): Promise<ActionResult<BulkSyncResult>> {
  const parsed = roomOverviewSyncSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 400, errorCode: "VALIDATION_ERROR", message: "동기화 범위가 올바르지 않습니다." };
  const access = await authorizeAccess(PERMISSIONS.SYNC_RUN);
  if (!access.allowed) return accessFailure(access.reason);

  try {
    if (parsed.data.propertyId) await requirePropertyAccess(parsed.data.propertyId, PERMISSIONS.SYNC_RUN);
    const sources = await listActiveCalendarSourceIdsForOverview({
      propertyId: parsed.data.propertyId,
      companyIds: companyScopeIds(access.context),
      accessScope: access.context.scope,
    }, CALENDAR_SYNC_BULK_MAX_SOURCES + 1);
    if (sources.length > CALENDAR_SYNC_BULK_MAX_SOURCES) return tooManySources();
    const data = await syncCalendarSources(sources, "syncRoomOverviewCalendarSources", access.context.userId);
    revalidateSyncViews();
    return { success: true, data, message: data.totalSources ? "전체 동기화를 완료했습니다." : "동기화할 활성 캘린더 연결이 없습니다." };
  } catch (error) {
    if (isAccessControlError(error)) return accessFailure(error instanceof Error && "reason" in error ? error.reason as "UNAUTHENTICATED" | "FORBIDDEN" | "COMPANY_SCOPE" : "FORBIDDEN");
    logServerError("syncRoomOverviewCalendarSources", error);
    return { success: false, status: 500, errorCode: "UNKNOWN_ERROR", message: "전체 동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
