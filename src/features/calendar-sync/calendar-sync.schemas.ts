import { z } from "zod";
export const syncCalendarSourceSchema = z.object({ calendarSourceId: z.string().trim().min(1, "캘린더 연결 ID가 필요합니다.") });
