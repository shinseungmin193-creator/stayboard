import { CALENDAR_SYNC_STALE_RUNNING_MS } from "../calendar-sync.constants";
export function isStaleRunning(startedAt: Date, now: Date): boolean { return startedAt.getTime() < now.getTime() - CALENDAR_SYNC_STALE_RUNNING_MS; }
