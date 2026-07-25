import { z } from "zod";
export const syncCalendarSourceSchema = z.object({ calendarSourceId: z.string().trim().min(1, "캘린더 연결 ID가 필요합니다.") });
export const bulkSyncCalendarSourcesSchema = z.object({ propertyId: z.string().trim().optional().transform((value) => value || undefined), roomId: z.string().trim().optional().transform((value) => value || undefined), provider: z.enum(["AIRBNB", "BOOKING", "AGODA"]).optional().or(z.literal("").transform(() => undefined)) });
