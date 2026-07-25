"use server";

import { revalidatePath } from "next/cache";
import { authorizeAccess, companyScopeIds, FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireCalendarSourceAccess, requireRoomAccess } from "@/features/access-control";
import { listActiveCalendarSourceIdsForRooms, listActiveCalendarSourceIdsForSync } from "@/features/calendar-sources";
import type { ActionResult } from "@/lib/action-result";
import { mapWithConcurrency } from "@/lib/concurrency";
import { logServerError } from "@/lib/prisma-errors";
import { syncCalendarSource } from "./application/sync-calendar-source";
import { CALENDAR_SYNC_BULK_MAX_SOURCES, CALENDAR_SYNC_BULK_TIMEOUT_MS, CALENDAR_SYNC_CONCURRENCY } from "./calendar-sync.constants";
import { bulkSyncCalendarSourcesSchema, syncCalendarSourceSchema } from "./calendar-sync.schemas";
import type { CalendarSyncResult } from "./domain/sync-result";
import type { CalendarProviderType, SyncExecutionMode } from "@/lib/generated/prisma/enums";
import { createSyncRun, finishSyncRun } from "./infrastructure/sync-run.repository";
import { findCalendarSourceForSync } from "./infrastructure/reservation-sync.repository";
import { summarizeError } from "./domain/sync-error";

export interface BulkSyncResult {
  targetCount: number;
  successCount: number;
  failedCount: number;
  alreadyRunningCount: number;
  results: Array<{ calendarSourceId: string; success: boolean; alreadyRunning: boolean; message: string }>;
}

function revalidateSyncViews() {
  revalidatePath("/calendar-sources");
  revalidatePath("/reservations");
  revalidatePath("/reservation-conflicts");
  revalidatePath("/");
}

type SyncTarget = { id: string; roomId: string; provider: CalendarProviderType };

async function syncCalendarSources(sources: SyncTarget[], logContext: string, actorUserId: string | null, executionMode: SyncExecutionMode = "MANUAL"): Promise<BulkSyncResult> {
  const bulkSignal = AbortSignal.timeout(CALENDAR_SYNC_BULK_TIMEOUT_MS);
  const roomGroups = new Map<string, SyncTarget[]>();
  for (const source of sources) roomGroups.set(source.roomId, [...(roomGroups.get(source.roomId) ?? []), source]);
  const groupedResults = await Promise.all([...roomGroups.entries()].map(async ([roomId, roomSources]) => {
    const startedAt = new Date();
    const run = await createSyncRun({ roomId, actorUserId, executionMode, targetCount: roomSources.length, startedAt });
    const results = await mapWithConcurrency(roomSources, CALENDAR_SYNC_CONCURRENCY, async ({ id }) => {
    if (bulkSignal.aborted) return { calendarSourceId: id, success: false, alreadyRunning: false, message: "전체 동기화 제한 시간을 초과했습니다." };
    try {
      await syncCalendarSource(id, bulkSignal, run.id);
      return { calendarSourceId: id, success: true, alreadyRunning: false, message: "완료" };
    } catch (error) {
      const alreadyRunning = error instanceof Error && error.name === "CalendarSyncAlreadyRunningError";
      const expected = error instanceof Error && error.name === "CalendarSyncError";
      if (!alreadyRunning && !expected) logServerError(logContext, error);
      const message = error instanceof Error && (alreadyRunning || expected)
        ? error.message
        : "동기화 중 안전하게 처리할 수 없는 오류가 발생했습니다.";
      return { calendarSourceId: id, success: false, alreadyRunning, message };
    }
    });
    const successCount = results.filter((item) => item.success).length;
    const failedCount = results.filter((item) => !item.success && !item.alreadyRunning).length;
    const errorSummary = results.filter((item) => !item.success).map((item) => summarizeError(item.message)).join(" · ") || null;
    await finishSyncRun(run.id, { successCount, failedCount, errorSummary, finishedAt: new Date() });
    return results;
  }));
  const results = groupedResults.flat();

  return {
    targetCount: results.length,
    successCount: results.filter((item) => item.success).length,
    failedCount: results.filter((item) => !item.success && !item.alreadyRunning).length,
    alreadyRunningCount: results.filter((item) => item.alreadyRunning).length,
    results,
  };
}

export async function syncCalendarSourceAction(
  _state: ActionResult<CalendarSyncResult>,
  formData: FormData,
): Promise<ActionResult<CalendarSyncResult>> {
  const parsed = syncCalendarSourceSchema.safeParse({ calendarSourceId: formData.get("calendarSourceId") });
  if (!parsed.success) return { success: false, message: "잘못된 동기화 요청입니다." };
  try {
    const context = await requireCalendarSourceAccess(parsed.data.calendarSourceId, PERMISSIONS.SYNC_RUN);
    const source = await findCalendarSourceForSync(parsed.data.calendarSourceId);
    if (!source) return { success: false, message: "CalendarSource를 찾을 수 없습니다." };
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
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof Error && (error.name === "CalendarSyncError" || error.name === "CalendarSyncAlreadyRunningError")) return { success: false, message: error.message };
    logServerError("syncCalendarSource", error);
    return { success: false, message: "예약 동기화에 실패했습니다." };
  }
}

export async function syncFilteredCalendarSourcesAction(
  _state: ActionResult<BulkSyncResult>,
  formData: FormData,
): Promise<ActionResult<BulkSyncResult>> {
  const parsed = bulkSyncCalendarSourcesSchema.safeParse({ propertyId: formData.get("propertyId"), roomId: formData.get("roomId"), provider: formData.get("provider") });
  if (!parsed.success) return { success: false, message: "동기화 필터가 올바르지 않습니다." };
  const access = await authorizeAccess(PERMISSIONS.SYNC_RUN);
  if (!access.allowed) return FORBIDDEN_ACTION_RESULT;
  try { if (parsed.data.roomId) await requireRoomAccess(parsed.data.roomId, PERMISSIONS.SYNC_RUN); }
  catch (error) { if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT; throw error; }
  const sources = await listActiveCalendarSourceIdsForSync({ ...parsed.data, companyIds: companyScopeIds(access.context) }, CALENDAR_SYNC_BULK_MAX_SOURCES + 1);
  if (sources.length > CALENDAR_SYNC_BULK_MAX_SOURCES) return { success: false, message: `대상이 ${CALENDAR_SYNC_BULK_MAX_SOURCES}개를 초과합니다. 필터 범위를 좁혀 주세요.` };
  const data = await syncCalendarSources(sources, "syncFilteredCalendarSources", access.context.userId);
  revalidateSyncViews();
  return { success: true, data, message: data.targetCount ? "필터 대상 동기화를 완료했습니다." : "동기화할 활성 캘린더 연결이 없습니다." };
}

export async function syncRoomCalendarSourcesAction(
  _state: ActionResult<BulkSyncResult>,
  formData: FormData,
): Promise<ActionResult<BulkSyncResult>> {
  const roomIds = [...new Set(formData.getAll("roomIds").flatMap((value) => typeof value === "string" && value.trim() ? [value.trim()] : []))];
  if (!roomIds.length) return { success: false, message: "동기화할 객실을 선택해 주세요." };
  const access = await authorizeAccess(PERMISSIONS.SYNC_RUN);
  if (!access.allowed) return FORBIDDEN_ACTION_RESULT;
  try { await Promise.all(roomIds.map((roomId) => requireRoomAccess(roomId, PERMISSIONS.SYNC_RUN))); }
  catch (error) { if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT; throw error; }
  const sources = await listActiveCalendarSourceIdsForRooms(roomIds, CALENDAR_SYNC_BULK_MAX_SOURCES + 1, companyScopeIds(access.context));
  if (sources.length > CALENDAR_SYNC_BULK_MAX_SOURCES) return { success: false, message: `대상이 ${CALENDAR_SYNC_BULK_MAX_SOURCES}개를 초과합니다. 필터 범위를 좁혀 주세요.` };
  const data = await syncCalendarSources(sources, "syncRoomCalendarSources", access.context.userId);
  revalidateSyncViews();
  return { success: true, data, message: data.targetCount ? "선택한 객실의 활성 연결 동기화를 완료했습니다." : "동기화할 활성 캘린더 연결이 없습니다." };
}
