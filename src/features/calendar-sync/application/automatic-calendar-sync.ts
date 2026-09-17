import "server-only";

import { summarizeError } from "../domain/sync-error";
import {
  automaticSyncDueBefore,
  readAutomaticCalendarSyncOptions,
} from "../domain/automatic-sync-policy";
import { listCalendarSourcesDueForAutomaticSync } from "../infrastructure/automatic-sync.repository";
import { syncCalendarSources } from "./sync-calendar-sources";

interface SchedulerState {
  timer: NodeJS.Timeout | null;
  running: boolean;
}

const schedulerKey = Symbol.for("stayboard.calendar-auto-sync-scheduler");

function schedulerState() {
  const scope = globalThis as typeof globalThis & { [schedulerKey]?: SchedulerState };
  scope[schedulerKey] ??= { timer: null, running: false };
  return scope[schedulerKey];
}

export async function runAutomaticCalendarSyncCycle(now = new Date()) {
  const options = readAutomaticCalendarSyncOptions();
  if (!options.enabled) return null;
  const sources = await listCalendarSourcesDueForAutomaticSync({
    dueBefore: automaticSyncDueBefore(now, options.staleAfterMs),
    limit: options.batchSize,
  });
  if (!sources.length) return null;
  const roomIds = [...new Set(sources.map((source) => source.roomId))];
  return syncCalendarSources(
    sources,
    "automaticCalendarSync",
    null,
    "AUTO",
    roomIds,
  );
}

export function startAutomaticCalendarSyncScheduler() {
  const options = readAutomaticCalendarSyncOptions();
  if (!options.enabled || process.env.NODE_ENV === "test") return;
  const state = schedulerState();
  if (state.timer || state.running) return;

  const schedule = (delay: number) => {
    state.timer = setTimeout(async () => {
      state.timer = null;
      if (state.running) {
        schedule(options.intervalMs);
        return;
      }
      state.running = true;
      try {
        const result = await runAutomaticCalendarSyncCycle();
        if (result) {
          console.info("[calendar-sync.auto.complete]", {
            targetCount: result.targetCount,
            successCount: result.successCount,
            warningCount: result.warningCount,
            failureCount: result.failureCount,
            skippedCount: result.skippedCount,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "자동 동기화 중 알 수 없는 오류가 발생했습니다.";
        console.error("[calendar-sync.auto.failed]", { reason: summarizeError(message) });
      } finally {
        state.running = false;
        schedule(options.intervalMs);
      }
    }, delay);
    state.timer.unref();
  };

  schedule(options.initialDelayMs);
}
