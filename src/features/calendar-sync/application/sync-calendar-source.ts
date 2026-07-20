import "server-only";
import type { CalendarProviderType } from "@/providers/calendar";
import { calendarProviderRegistry, CalendarFetchError } from "@/providers/calendar";
import { parseIcsCalendar, IcsDocumentParseError } from "../infrastructure/ics-parser";
import { reservationNormalizerRegistry } from "../providers/normalizer-registry";
import { createRunningSyncLog, EmptyCalendarProtectionError, failSyncLog, findCalendarSourceForSync, persistReservationSync } from "../infrastructure/reservation-sync.repository";
import type { CalendarSyncResult } from "../domain/sync-result";

const SYNC_ERROR_MAX_LENGTH = 500;
export class CalendarSyncError extends Error { constructor(message: string) { super(message); this.name = "CalendarSyncError"; } }
function safeMessage(error: unknown): string { if (error instanceof CalendarFetchError || error instanceof IcsDocumentParseError || error instanceof EmptyCalendarProtectionError || error instanceof CalendarSyncError) return error.message.slice(0, SYNC_ERROR_MAX_LENGTH); return "예약 동기화 중 안전하게 처리할 수 없는 오류가 발생했습니다."; }

export async function syncCalendarSource(calendarSourceId: string): Promise<CalendarSyncResult> {
  const source = await findCalendarSourceForSync(calendarSourceId);
  if (!source) throw new CalendarSyncError("캘린더 연결을 찾을 수 없습니다.");
  if (!source.isActive) throw new CalendarSyncError("비활성 캘린더 연결은 동기화할 수 없습니다.");
  if (!(["AIRBNB", "BOOKING", "AGODA"] as string[]).includes(source.provider)) throw new CalendarSyncError("이 Provider는 아직 예약 동기화를 지원하지 않습니다.");
  const providerType = source.provider as CalendarProviderType;
  const provider = calendarProviderRegistry.get(providerType); const normalizer = reservationNormalizerRegistry.get(providerType);
  const startedAt = new Date(); const syncLog = await createRunningSyncLog(source.id, startedAt); let fetchedCount = 0;
  try {
    const document = await provider.fetchCalendar({ calendarUrl: source.calendarUrl });
    const parsed = parseIcsCalendar(document.content); fetchedCount = parsed.totalEventCount;
    const unique = new Map<string, ReturnType<typeof normalizer.normalize>>();
    for (const event of parsed.events) { const reservation = normalizer.normalize(event); if (reservation && !unique.has(reservation.rawUid)) unique.set(reservation.rawUid, reservation); }
    const reservations = [...unique.values()].filter((reservation): reservation is NonNullable<typeof reservation> => reservation !== null);
    if (parsed.totalEventCount > 0 && reservations.length === 0) throw new CalendarSyncError("유효한 예약 이벤트가 없어 기존 예약을 변경하지 않았습니다.");
    const completedAt = new Date();
    const persisted = await persistReservationSync({ syncLogId: syncLog.id, calendarSourceId: source.id, propertyId: source.room.propertyId, roomId: source.roomId, provider: source.provider, reservations, fetchedCount, syncStartedAt: startedAt, completedAt });
    return { calendarSourceId: source.id, provider: source.provider, fetchedCount, parsedCount: reservations.length, excludedCount: parsed.excludedCount + (parsed.events.length - reservations.length), ...persisted, completedAt: completedAt.toISOString() };
  } catch (error) {
    const message = safeMessage(error);
    try { await failSyncLog(syncLog.id, new Date(), message, fetchedCount); } catch { throw new CalendarSyncError(`${message} 동기화 실패 로그를 갱신하지 못했습니다.`); }
    throw new CalendarSyncError(message);
  }
}
