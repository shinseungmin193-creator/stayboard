import "server-only";

import type { CalendarProviderType, SyncExecutionMode } from "@/lib/generated/prisma/enums";
import { mapWithConcurrency } from "@/lib/concurrency";
import { logServerError } from "@/lib/prisma-errors";
import { CALENDAR_SYNC_BULK_TIMEOUT_MS, CALENDAR_SYNC_CONCURRENCY } from "../calendar-sync.constants";
import { summarizeError } from "../domain/sync-error";
import { createSyncRun, finishSyncRun } from "../infrastructure/sync-run.repository";
import { syncCalendarSource } from "./sync-calendar-source";

export type CalendarSyncTarget = { id: string; roomId: string; provider: CalendarProviderType };

export interface CalendarSourceSyncResult {
  calendarSourceId: string;
  success: boolean;
  alreadyRunning: boolean;
  createdReservations: number;
  updatedReservations: number;
  message: string;
}

export interface BulkCalendarSyncResult {
  totalSources: number;
  targetCount: number;
  successCount: number;
  failureCount: number;
  failedCount: number;
  alreadyRunningCount: number;
  createdReservations: number;
  updatedReservations: number;
  results: CalendarSourceSyncResult[];
}

export async function syncCalendarSources(
  sources: CalendarSyncTarget[],
  logContext: string,
  actorUserId: string | null,
  executionMode: SyncExecutionMode = "MANUAL",
): Promise<BulkCalendarSyncResult> {
  const bulkSignal = AbortSignal.timeout(CALENDAR_SYNC_BULK_TIMEOUT_MS);
  const roomGroups = new Map<string, CalendarSyncTarget[]>();
  for (const source of sources) roomGroups.set(source.roomId, [...(roomGroups.get(source.roomId) ?? []), source]);

  const groupedResults = await mapWithConcurrency(
    [...roomGroups.entries()],
    CALENDAR_SYNC_CONCURRENCY,
    async ([roomId, roomSources]): Promise<CalendarSourceSyncResult[]> => {
      const startedAt = new Date();
      let run: Awaited<ReturnType<typeof createSyncRun>>;
      try {
        run = await createSyncRun({ roomId, actorUserId, executionMode, targetCount: roomSources.length, startedAt });
      } catch (error) {
        logServerError(logContext, error);
        return roomSources.map(({ id }) => ({
          calendarSourceId: id,
          success: false,
          alreadyRunning: false,
          createdReservations: 0,
          updatedReservations: 0,
          message: "동기화 실행 기록을 시작하지 못했습니다.",
        }));
      }

      // 같은 객실의 소스는 객실 단위 advisory lock을 공유하므로 순차 실행한다.
      const results = await mapWithConcurrency(roomSources, 1, async ({ id }): Promise<CalendarSourceSyncResult> => {
        if (bulkSignal.aborted) return { calendarSourceId: id, success: false, alreadyRunning: false, createdReservations: 0, updatedReservations: 0, message: "전체 동기화 제한 시간을 초과했습니다." };
        try {
          const synced = await syncCalendarSource(id, bulkSignal, run.id);
          return {
            calendarSourceId: id,
            success: true,
            alreadyRunning: false,
            createdReservations: synced.createdCount,
            updatedReservations: synced.updatedCount,
            message: "완료",
          };
        } catch (error) {
          const alreadyRunning = error instanceof Error && error.name === "CalendarSyncAlreadyRunningError";
          const expected = error instanceof Error && error.name === "CalendarSyncError";
          if (!alreadyRunning && !expected) logServerError(logContext, error);
          return {
            calendarSourceId: id,
            success: false,
            alreadyRunning,
            createdReservations: 0,
            updatedReservations: 0,
            message: error instanceof Error && (alreadyRunning || expected) ? error.message : "동기화 중 안전하게 처리할 수 없는 오류가 발생했습니다.",
          };
        }
      });

      const successCount = results.filter((item) => item.success).length;
      const failedCount = results.filter((item) => !item.success && !item.alreadyRunning).length;
      const errorSummary = results.filter((item) => !item.success).map((item) => summarizeError(item.message)).join(" · ") || null;
      try {
        await finishSyncRun(run.id, { successCount, failedCount, errorSummary, finishedAt: new Date() });
      } catch (error) {
        logServerError(`${logContext}.finishSyncRun`, error);
      }
      return results;
    },
  );

  const results = groupedResults.flat();
  const failureCount = results.filter((item) => !item.success && !item.alreadyRunning).length;
  return {
    totalSources: results.length,
    targetCount: results.length,
    successCount: results.filter((item) => item.success).length,
    failureCount,
    failedCount: failureCount,
    alreadyRunningCount: results.filter((item) => item.alreadyRunning).length,
    createdReservations: results.reduce((sum, item) => sum + item.createdReservations, 0),
    updatedReservations: results.reduce((sum, item) => sum + item.updatedReservations, 0),
    results,
  };
}
