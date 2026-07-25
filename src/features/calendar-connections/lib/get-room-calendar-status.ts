import type { RoomCalendarStatus } from "../types/room-calendar-summary";

export function getRoomCalendarStatus(input: { activeSourceCount: number; targetCount?: number; successCount?: number; failedCount?: number; running?: boolean }): RoomCalendarStatus {
  if (input.running) return "SYNCING";
  if (input.activeSourceCount === 0) return "DISABLED";
  if (input.targetCount === undefined) return "NOT_SYNCED";
  if ((input.failedCount ?? 0) === 0 && input.successCount === input.targetCount) return "HEALTHY";
  if ((input.successCount ?? 0) > 0 && (input.failedCount ?? 0) > 0) return "PARTIAL_FAILURE";
  if (input.targetCount > 0 && input.successCount === 0 && (input.failedCount ?? 0) > 0) return "FAILED";
  return "NOT_SYNCED";
}
