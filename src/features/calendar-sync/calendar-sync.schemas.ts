import { z } from "zod";
import { CALENDAR_SYNC_SELECTED_ROOM_MAX } from "./calendar-sync.constants";
export const syncCalendarSourceSchema = z.object({ calendarSourceId: z.string().trim().min(1, "캘린더 연결 ID가 필요합니다.") });
export const bulkSyncCalendarSourcesSchema = z.object({ propertyId: z.string().trim().optional().transform((value) => value || undefined), roomId: z.string().trim().optional().transform((value) => value || undefined), provider: z.enum(["AIRBNB", "BOOKING", "AGODA"]).optional().or(z.literal("").transform(() => undefined)) });
export const roomCalendarFilteredSyncSchema = bulkSyncCalendarSourcesSchema.pick({ propertyId: true, roomId: true, provider: true }).extend({ status: z.enum(["HEALTHY", "WARNING", "PARTIAL_FAILURE", "FAILED", "SYNCING", "NOT_SYNCED", "DISABLED"]).optional().or(z.literal("").transform(() => undefined)) });
export const roomOverviewSyncSchema = z.object({ propertyId: z.string().trim().max(100).optional().transform((value) => value || undefined) });
export const selectedRoomCalendarSyncSchema = z.object({
  roomIds: z.array(z.string().trim().min(1).max(100)).min(1).max(CALENDAR_SYNC_SELECTED_ROOM_MAX),
});
