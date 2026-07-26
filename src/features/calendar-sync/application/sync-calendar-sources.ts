import "server-only";

import type { CalendarProviderType, SyncExecutionMode } from "@/lib/generated/prisma/enums";
import { mapWithConcurrency } from "@/lib/concurrency";
import { logServerError } from "@/lib/prisma-errors";
import { CALENDAR_SYNC_BULK_TIMEOUT_MS, CALENDAR_SYNC_CONCURRENCY, CALENDAR_SYNC_ROOM_BATCH_SIZE } from "../calendar-sync.constants";
import { summarizeError } from "../domain/sync-error";
import { chunkItems, summarizeBulkSync, type BulkSyncOutcome } from "../domain/bulk-sync-summary";
import { createSyncRun, finishSyncRun } from "../infrastructure/sync-run.repository";
import { syncCalendarSource } from "./sync-calendar-source";

export type CalendarSyncTarget = { id: string; roomId: string; provider: CalendarProviderType };
export type CalendarSourceSyncOutcome = BulkSyncOutcome;

export interface CalendarSourceSyncResult {
  calendarSourceId: string;
  roomId: string;
  provider: CalendarProviderType;
  outcome: CalendarSourceSyncOutcome;
  success: boolean;
  alreadyRunning: boolean;
  createdReservations: number;
  updatedReservations: number;
  message: string;
}

export interface BulkCalendarSyncResult {
  targetRoomCount: number;
  activeSourceCount: number;
  roomsWithoutActiveSources: number;
  totalSources: number;
  targetCount: number;
  successCount: number;
  failureCount: number;
  failedCount: number;
  skippedCount: number;
  alreadyRunningCount: number;
  createdReservations: number;
  updatedReservations: number;
  results: CalendarSourceSyncResult[];
}

function skippedResult(source: CalendarSyncTarget, message: string, alreadyRunning = false): CalendarSourceSyncResult {
  return { calendarSourceId: source.id, roomId: source.roomId, provider: source.provider, outcome: "SKIPPED", success: false, alreadyRunning, createdReservations: 0, updatedReservations: 0, message };
}

function failedResult(source: CalendarSyncTarget, message: string): CalendarSourceSyncResult {
  return { calendarSourceId: source.id, roomId: source.roomId, provider: source.provider, outcome: "FAILED", success: false, alreadyRunning: false, createdReservations: 0, updatedReservations: 0, message };
}

export async function syncCalendarSources(
  sources: CalendarSyncTarget[],
  logContext: string,
  actorUserId: string | null,
  executionMode: SyncExecutionMode = "MANUAL",
  targetRoomIds?: readonly string[],
): Promise<BulkCalendarSyncResult> {
  const bulkSignal = AbortSignal.timeout(CALENDAR_SYNC_BULK_TIMEOUT_MS);
  const roomGroups = new Map<string, CalendarSyncTarget[]>();
  for (const source of sources) roomGroups.set(source.roomId, [...(roomGroups.get(source.roomId) ?? []), source]);
  const roomBatches = chunkItems([...roomGroups.entries()], CALENDAR_SYNC_ROOM_BATCH_SIZE);
  const allResults: CalendarSourceSyncResult[] = [];

  for (const [batchIndex, batch] of roomBatches.entries()) {
    const batchSourceCount = batch.reduce((sum, [, roomSources]) => sum + roomSources.length, 0);
    console.info("[calendar-sync.bulk.batch.start]", { context: logContext, batchNumber: batchIndex + 1, batchCount: roomBatches.length, targetRoomCount: batch.length, calendarSourceCount: batchSourceCount });
    const groupedResults = await mapWithConcurrency(batch, CALENDAR_SYNC_CONCURRENCY, async ([roomId, roomSources]): Promise<CalendarSourceSyncResult[]> => {
      if (bulkSignal.aborted) return roomSources.map((source) => skippedResult(source, "전체 동기화 제한 시간을 초과해 시작하지 못했습니다."));
      const startedAt = new Date();
      let run: Awaited<ReturnType<typeof createSyncRun>>;
      try {
        run = await createSyncRun({ roomId, actorUserId, executionMode, targetCount: roomSources.length, startedAt });
      } catch (error) {
        logServerError(logContext, error);
        return roomSources.map((source) => failedResult(source, "동기화 실행 기록을 시작하지 못했습니다."));
      }

      // 같은 객실의 소스는 객실 단위 advisory lock을 공유하므로 순차 실행한다.
      const results = await mapWithConcurrency(roomSources, 1, async (source): Promise<CalendarSourceSyncResult> => {
        if (bulkSignal.aborted) return skippedResult(source, "전체 동기화 제한 시간을 초과해 시작하지 못했습니다.");
        try {
          const synced = await syncCalendarSource(source.id, bulkSignal, run.id);
          return { calendarSourceId: source.id, roomId: source.roomId, provider: source.provider, outcome: "SUCCESS", success: true, alreadyRunning: false, createdReservations: synced.createdCount, updatedReservations: synced.updatedCount, message: "완료" };
        } catch (error) {
          const alreadyRunning = error instanceof Error && error.name === "CalendarSyncAlreadyRunningError";
          const expected = error instanceof Error && error.name === "CalendarSyncError";
          if (!alreadyRunning && !expected) logServerError(logContext, error);
          const message = error instanceof Error && (alreadyRunning || expected) ? error.message : "동기화 중 안전하게 처리할 수 없는 오류가 발생했습니다.";
          return alreadyRunning ? skippedResult(source, message, true) : failedResult(source, message);
        }
      });

      const successCount = results.filter((item) => item.outcome === "SUCCESS").length;
      const failedCount = results.filter((item) => item.outcome === "FAILED").length;
      const errorSummary = results.filter((item) => item.outcome !== "SUCCESS").map((item) => summarizeError(item.message)).join(" · ") || null;
      try {
        await finishSyncRun(run.id, { successCount, failedCount, errorSummary, finishedAt: new Date() });
      } catch (error) {
        logServerError(`${logContext}.finishSyncRun`, error);
      }
      return results;
    });
    const batchResults = groupedResults.flat();
    allResults.push(...batchResults);
    for (const result of batchResults.filter((item) => item.outcome === "FAILED")) {
      console.warn("[calendar-sync.bulk.source.failed]", { context: logContext, roomId: result.roomId, calendarSourceId: result.calendarSourceId, provider: result.provider, reason: summarizeError(result.message) });
    }
    console.info("[calendar-sync.bulk.batch.complete]", {
      context: logContext,
      batchNumber: batchIndex + 1,
      batchCount: roomBatches.length,
      targetRoomCount: batch.length,
      calendarSourceCount: batchResults.length,
      successCount: batchResults.filter((item) => item.outcome === "SUCCESS").length,
      failureCount: batchResults.filter((item) => item.outcome === "FAILED").length,
      skippedCount: batchResults.filter((item) => item.outcome === "SKIPPED").length,
    });
  }

  const summary = summarizeBulkSync({ targetRoomIds: targetRoomIds ?? sources.map((source) => source.roomId), sources, outcomes: allResults.map((item) => item.outcome) });
  return {
    targetRoomCount: summary.targetRoomCount,
    activeSourceCount: summary.activeSourceCount,
    roomsWithoutActiveSources: summary.roomsWithoutActiveSources,
    totalSources: sources.length,
    targetCount: sources.length,
    successCount: summary.successCount,
    failureCount: summary.failureCount,
    failedCount: summary.failureCount,
    skippedCount: summary.skippedCount,
    alreadyRunningCount: allResults.filter((item) => item.alreadyRunning).length,
    createdReservations: allResults.reduce((sum, item) => sum + item.createdReservations, 0),
    updatedReservations: allResults.reduce((sum, item) => sum + item.updatedReservations, 0),
    results: allResults,
  };
}
