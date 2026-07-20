"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { logServerError } from "@/lib/prisma-errors";
import type { CalendarSyncResult } from "./domain/sync-result";
import { syncCalendarSource } from "./application/sync-calendar-source";
import { syncCalendarSourceSchema } from "./calendar-sync.schemas";

export async function syncCalendarSourceAction(_state: ActionResult<CalendarSyncResult>, formData: FormData): Promise<ActionResult<CalendarSyncResult>> {
  const parsed = syncCalendarSourceSchema.safeParse({ calendarSourceId: formData.get("calendarSourceId") }); if (!parsed.success) return { success: false, message: "잘못된 동기화 요청입니다." };
  try { const data = await syncCalendarSource(parsed.data.calendarSourceId); revalidatePath("/calendar-sources"); revalidatePath("/reservations"); revalidatePath("/"); return { success: true, data, message: "예약 동기화를 완료했습니다." }; }
  catch (error) { if (error instanceof Error && error.name === "CalendarSyncError") return { success: false, message: error.message }; logServerError("syncCalendarSource", error); return { success: false, message: "예약 동기화에 실패했습니다." }; }
}
