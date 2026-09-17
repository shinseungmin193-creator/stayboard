import {
  CALENDAR_AUTO_SYNC_BATCH_SIZE,
  CALENDAR_AUTO_SYNC_INITIAL_DELAY_MS,
  CALENDAR_AUTO_SYNC_INTERVAL_MS,
  CALENDAR_AUTO_SYNC_STALE_AFTER_MS,
} from "../calendar-sync.constants";

export interface AutomaticCalendarSyncOptions {
  enabled: boolean;
  intervalMs: number;
  staleAfterMs: number;
  initialDelayMs: number;
  batchSize: number;
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

export function readAutomaticCalendarSyncOptions(
  env: Record<string, string | undefined> = process.env,
): AutomaticCalendarSyncOptions {
  return {
    enabled: env.CALENDAR_AUTO_SYNC_ENABLED?.trim().toLowerCase() !== "false",
    intervalMs: positiveInteger(env.CALENDAR_AUTO_SYNC_INTERVAL_MS, CALENDAR_AUTO_SYNC_INTERVAL_MS, 60 * 60 * 1000),
    staleAfterMs: positiveInteger(env.CALENDAR_AUTO_SYNC_STALE_AFTER_MS, CALENDAR_AUTO_SYNC_STALE_AFTER_MS, 24 * 60 * 60 * 1000),
    initialDelayMs: positiveInteger(env.CALENDAR_AUTO_SYNC_INITIAL_DELAY_MS, CALENDAR_AUTO_SYNC_INITIAL_DELAY_MS, 60 * 60 * 1000),
    batchSize: positiveInteger(env.CALENDAR_AUTO_SYNC_BATCH_SIZE, CALENDAR_AUTO_SYNC_BATCH_SIZE, 5_000),
  };
}

export function automaticSyncDueBefore(now: Date, staleAfterMs: number) {
  return new Date(now.getTime() - staleAfterMs);
}
