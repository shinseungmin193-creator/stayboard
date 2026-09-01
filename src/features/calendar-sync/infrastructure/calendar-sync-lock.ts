import "server-only";
import { AdvisoryLockUnavailableError, withPostgresAdvisoryLocks } from "@/lib/postgres-advisory-lock";

export class CalendarSyncAlreadyRunningError extends Error {
  readonly code = "CALENDAR_SYNC_ALREADY_RUNNING";
  constructor() { super("이미 동기화가 진행 중입니다. 잠시 후 다시 시도해 주세요."); this.name = "CalendarSyncAlreadyRunningError"; }
}

const sourceLockKey = (calendarSourceId: string) => `calendar-source:${calendarSourceId}`;
const roomLockKey = (roomId: string) => `reservation-conflicts-room:${roomId}`;

export async function withCalendarSourceAdvisoryLock<T>(calendarSourceId: string, roomId: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await withPostgresAdvisoryLocks([sourceLockKey(calendarSourceId), roomLockKey(roomId)], operation);
  } catch (error) {
    if (error instanceof AdvisoryLockUnavailableError) throw new CalendarSyncAlreadyRunningError();
    throw error;
  }
}
