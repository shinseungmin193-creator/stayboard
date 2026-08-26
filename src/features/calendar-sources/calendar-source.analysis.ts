import "server-only";
import type { CalendarProviderType, CalendarFetchResult } from "@/providers/calendar";
import { ICS_MAX_VEVENTS } from "@/providers/calendar/constants";
import { parseIcsCalendar, IcsDocumentParseError } from "@/features/calendar-sync/infrastructure/ics-parser";
import { classifyCalendarEvents } from "@/features/calendar-sync/domain/classify-calendar-events";
import { reservationNormalizerRegistry } from "@/features/calendar-sync/providers/normalizer-registry";
import { createCalendarFeedFingerprint } from "@/features/calendar-sync/domain/calendar-feed-fingerprint";
import { countFailedCalendarEvents } from "@/features/calendar-sync/domain/calendar-sync-diagnostics";
import type { CalendarConnectionResult } from "./calendar-source.types";

export type CalendarParseErrorCode = "PARSE" | "EVENT_LIMIT" | "CLASSIFICATION";
export class CalendarParseError extends Error {
  constructor(public readonly code: CalendarParseErrorCode = "PARSE", message = "ICS 다운로드에는 성공했지만 캘린더 내용을 분석하지 못했습니다.") {
    super(message);
    this.name = "CalendarParseError";
  }
}

export function analyzeCalendarFeed(result: CalendarFetchResult, responseTimeMs: number, calendarHostname: string) {
  try {
    const parsed = parseIcsCalendar(result.content);
    if (parsed.totalEventCount > ICS_MAX_VEVENTS) throw new CalendarParseError("EVENT_LIMIT", "캘린더 이벤트 수가 허용 한도를 초과했습니다.");
    const provider = result.provider as CalendarProviderType;
    const normalizer = reservationNormalizerRegistry.get(provider);
    const classified = classifyCalendarEvents(parsed.events, normalizer, parsed.excludedCount, countFailedCalendarEvents(parsed.issues));
    const connection: CalendarConnectionResult = {
      provider: result.provider,
      responseTimeMs,
      fetchedAt: result.fetchedAt.toISOString(),
      contentType: result.contentType,
      eventCount: parsed.totalEventCount,
      uidCount: parsed.events.length,
      startCount: parsed.events.length,
      endCount: parsed.events.length,
      summaryCount: parsed.events.filter((event) => Boolean(event.summary)).length,
      reservationCount: classified.reservationEventCount,
      blockedCount: classified.blockedEventCount,
      cancelledCount: classified.cancelledEventCount,
      unknownCount: classified.unknownEventCount,
    };
    const fingerprint = createCalendarFeedFingerprint({ provider, classificationVersion: normalizer.classificationVersion, calendarHostname, prodId: parsed.prodId, totalEventCount: parsed.totalEventCount, events: parsed.events, counts: classified });
    return { connection, parsed, classified, fingerprint };
  } catch (error) {
    if (error instanceof CalendarParseError) throw error;
    if (error instanceof IcsDocumentParseError) throw new CalendarParseError("PARSE", error.message);
    throw new CalendarParseError();
  }
}

export function analyzeCalendar(result: CalendarFetchResult, responseTimeMs: number, calendarHostname: string): CalendarConnectionResult {
  return analyzeCalendarFeed(result, responseTimeMs, calendarHostname).connection;
}
