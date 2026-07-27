import "server-only";
import type { CalendarProviderType } from "@/providers/calendar";
import type { Prisma } from "@/lib/generated/prisma/client";
import { calendarProviderRegistry } from "@/providers/calendar";
import { canCancelMissingReservations, classifyCalendarEvents, EMPTY_CALENDAR_EVENT_CLASSIFICATION_COUNTS } from "../domain/classify-calendar-events";
import type { CalendarSyncResult } from "../domain/sync-result";
import { withCalendarSourceAdvisoryLock } from "../infrastructure/calendar-sync-lock";
import { IcsDocumentParseError, parseIcsCalendar } from "../infrastructure/ics-parser";
import { createRunningSyncLog, failSyncLog, findCalendarSourceForSync, markStaleRunningSyncLogs, persistReservationSync } from "../infrastructure/reservation-sync.repository";
import { reservationNormalizerRegistry } from "../providers/normalizer-registry";
import { standardizeSyncError } from "../domain/sync-error";
import { countFailedCalendarEvents, createCalendarSyncDiagnosticPayload, type CalendarSyncDiagnosticPayload } from "../domain/calendar-sync-diagnostics";
import { isCalendarSyncWarning } from "../domain/sync-health";

export class CalendarSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarSyncError";
  }
}

export async function syncCalendarSource(calendarSourceId: string, signal?: AbortSignal, syncRunId?: string): Promise<CalendarSyncResult> {
  const source = await findCalendarSourceForSync(calendarSourceId);
  if (!source) throw new CalendarSyncError("캘린더 연결을 찾을 수 없습니다.");
  if (!source.isActive) throw new CalendarSyncError("비활성 캘린더 연결은 동기화할 수 없습니다.");
  if (!(new Set<string>(["AIRBNB", "BOOKING", "AGODA"])).has(source.provider)) throw new CalendarSyncError("이 Provider는 아직 예약 동기화를 지원하지 않습니다.");

  return withCalendarSourceAdvisoryLock(source.id, source.roomId, async () => {
    const providerType = source.provider as CalendarProviderType;
    const provider = calendarProviderRegistry.get(providerType);
    const normalizer = reservationNormalizerRegistry.get(providerType);
    const startedAt = new Date();
    await markStaleRunningSyncLogs(source.id, startedAt);
    const syncLog = await createRunningSyncLog(source.id, source.provider, startedAt, syncRunId);
    let fetchedCount = 0;
    let eventCounts = EMPTY_CALENDAR_EVENT_CLASSIFICATION_COUNTS;
    let unknownEventDetails: Array<{ calendarSourceId: string; provider: CalendarProviderType; uidPresent: boolean; summaryPreview: string | null; descriptionPresent: boolean; status: string | null; reason: string }> = [];
    let eventDiagnostics: CalendarSyncDiagnosticPayload = { version: 1, events: [], truncatedEventCount: 0, exclusionReasonCounts: {} };

    try {
      const document = await provider.fetchCalendar({ calendarUrl: source.calendarUrl, signal });
      let parsed: ReturnType<typeof parseIcsCalendar>;
      try {
        parsed = parseIcsCalendar(document.content);
      } catch (error) {
        if (error instanceof IcsDocumentParseError && error.diagnostics) {
          fetchedCount = error.diagnostics.totalEventCount;
          const failedEventCount = countFailedCalendarEvents(error.diagnostics.issues);
          eventCounts = { ...EMPTY_CALENDAR_EVENT_CLASSIFICATION_COUNTS, parsedEventCount: error.diagnostics.parsedEventCount, failedEventCount, skippedEventCount: error.diagnostics.issues.length };
          eventDiagnostics = createCalendarSyncDiagnosticPayload({ events: [], eventDiagnosticTruncatedCount: 0, issues: error.diagnostics.issues, counts: eventCounts });
        }
        throw error;
      }
      fetchedCount = parsed.totalEventCount;
      const failedEventCount = countFailedCalendarEvents(parsed.issues);
      const classified = classifyCalendarEvents(parsed.events, normalizer, parsed.excludedCount, failedEventCount);
      const { reservations, blockedUids, unknownUids, unknownEvents, eventDiagnostics: classifiedDiagnostics, eventDiagnosticTruncatedCount, ...classificationCounts } = classified;
      eventCounts = classificationCounts;
      unknownEventDetails = unknownEvents.map((event) => ({ calendarSourceId: source.id, provider: providerType, ...event }));
      eventDiagnostics = createCalendarSyncDiagnosticPayload({ events: classifiedDiagnostics, eventDiagnosticTruncatedCount, issues: parsed.issues, counts: eventCounts });
      const completedAt = new Date();
      const persisted = await persistReservationSync({
        syncLogId: syncLog.id,
        calendarSourceId: source.id,
        propertyId: source.room.propertyId,
        roomId: source.roomId,
        provider: source.provider,
        reservations,
        blockedUids,
        unknownUids,
        unknownEventDetails,
        eventDiagnostics: eventDiagnostics as unknown as Prisma.InputJsonValue,
        allowMissingCancellation: canCancelMissingReservations(parsed.issues, eventCounts.unknownEventCount),
        eventCounts,
        fetchedCount,
        syncStartedAt: startedAt,
        completedAt,
      });

      return {
        calendarSourceId: source.id,
        provider: source.provider,
        warning: isCalendarSyncWarning({
          status: "SUCCESS",
          fetchedEventCount: fetchedCount,
          reservationEventCount: eventCounts.reservationEventCount,
          blockedEventCount: eventCounts.blockedEventCount,
          cancelledEventCount: eventCounts.cancelledEventCount,
          unknownEventCount: eventCounts.unknownEventCount,
          failedEventCount: eventCounts.failedEventCount,
        }),
        fetchedCount,
        parsedCount: eventCounts.parsedEventCount,
        excludedCount: eventCounts.skippedEventCount,
        ...eventCounts,
        ...persisted,
        completedAt: completedAt.toISOString(),
      };
    } catch (error) {
      const standardized = standardizeSyncError(error);
      const message = standardized.safeMessage;
      try {
        await failSyncLog(syncLog.id, startedAt, new Date(), standardized, fetchedCount, eventCounts, unknownEventDetails, eventDiagnostics as unknown as Prisma.InputJsonValue);
      } catch {
        throw new CalendarSyncError(`${message} 동기화 실패 로그를 갱신하지 못했습니다.`);
      }
      throw new CalendarSyncError(message);
    }
  });
}
