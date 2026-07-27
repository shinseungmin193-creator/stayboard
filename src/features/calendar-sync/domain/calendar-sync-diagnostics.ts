import type { CalendarEventClassification, CalendarParseIssue, ParsedCalendarEvent } from "./calendar-event";

export const CALENDAR_EVENT_DIAGNOSTIC_LIMIT = 50;

export type CalendarEventExclusionReason =
  | "BLOCKED_BY_PROVIDER_RULE"
  | "CANCELLED_BY_PROVIDER_RULE"
  | "PROVIDER_CLASSIFIER_NO_MATCH";

export interface CalendarEventDiagnostic {
  uidPresent: boolean;
  startDate: string;
  endDate: string;
  status: string | null;
  summaryPreview: string | null;
  descriptionPresent: boolean;
  classification: CalendarEventClassification;
  exclusionReason: CalendarEventExclusionReason | null;
}

export interface CalendarSyncDiagnosticPayload {
  version: 1;
  events: CalendarEventDiagnostic[];
  truncatedEventCount: number;
  exclusionReasonCounts: Record<string, number>;
}

const SAFE_OPERATIONAL_SUMMARY = /^(?:airbnb(?:\s*\(not available\))?|agoda reservation|stay\s*-\s*booking\.com|closed(?:\s*-\s*not available)?|not available|unavailable|reserved|reservation|booking|blocked|maintenance|owner use|stop sell|room closed|restrictions|calendar blocked|owner block(?:ed)?|booking canc?elled|cancelled|canceled)$/i;

function normalizeDiagnosticText(value: string): string {
  return value.normalize("NFKC").replace(/[\p{Cc}\p{Cf}\s]+/gu, " ").trim();
}

export function safeCalendarSummaryPreview(value: string | null): string | null {
  if (!value) return null;
  const normalized = normalizeDiagnosticText(value).slice(0, 120);
  if (!normalized) return null;
  return SAFE_OPERATIONAL_SUMMARY.test(normalized) ? normalized : "[비공개]";
}

export function safeCalendarStatus(value: string | null): string | null {
  if (!value) return null;
  const normalized = normalizeDiagnosticText(value).toUpperCase().slice(0, 30);
  return /^[A-Z_-]+$/.test(normalized) ? normalized : "[비공개]";
}

function exclusionReason(classification: CalendarEventClassification): CalendarEventExclusionReason | null {
  if (classification === "BLOCKED") return "BLOCKED_BY_PROVIDER_RULE";
  if (classification === "CANCELLED") return "CANCELLED_BY_PROVIDER_RULE";
  if (classification === "UNKNOWN") return "PROVIDER_CLASSIFIER_NO_MATCH";
  return null;
}

export function createCalendarEventDiagnostic(event: ParsedCalendarEvent, classification: CalendarEventClassification): CalendarEventDiagnostic {
  return {
    uidPresent: Boolean(event.uid),
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    status: safeCalendarStatus(event.status),
    summaryPreview: safeCalendarSummaryPreview(event.summary),
    descriptionPresent: Boolean(event.description),
    classification,
    exclusionReason: exclusionReason(classification),
  };
}

export function countFailedCalendarEvents(issues: readonly CalendarParseIssue[]): number {
  return issues.filter((issue) => issue.reason !== "DUPLICATE_UID").length;
}

export function createCalendarSyncDiagnosticPayload(input: {
  events: readonly CalendarEventDiagnostic[];
  eventDiagnosticTruncatedCount: number;
  issues: readonly CalendarParseIssue[];
  counts: { blockedEventCount: number; cancelledEventCount: number; unknownEventCount: number };
}): CalendarSyncDiagnosticPayload {
  const exclusionReasonCounts: Record<string, number> = {};
  const add = (reason: string, count: number) => { if (count > 0) exclusionReasonCounts[reason] = (exclusionReasonCounts[reason] ?? 0) + count; };
  add("BLOCKED_BY_PROVIDER_RULE", input.counts.blockedEventCount);
  add("CANCELLED_BY_PROVIDER_RULE", input.counts.cancelledEventCount);
  add("PROVIDER_CLASSIFIER_NO_MATCH", input.counts.unknownEventCount);
  for (const issue of input.issues) add(issue.reason, 1);
  return {
    version: 1,
    events: [...input.events],
    truncatedEventCount: input.eventDiagnosticTruncatedCount,
    exclusionReasonCounts,
  };
}

const CLASSIFICATIONS = new Set<CalendarEventClassification>(["RESERVATION", "BLOCKED", "CANCELLED", "UNKNOWN"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDiagnosticEvent(value: unknown): CalendarEventDiagnostic | null {
  if (!isRecord(value) || !CLASSIFICATIONS.has(value.classification as CalendarEventClassification)) return null;
  const startDate = typeof value.startDate === "string" ? value.startDate : "";
  const endDate = typeof value.endDate === "string" ? value.endDate : "";
  const rawReason = typeof value.exclusionReason === "string" && /^[A-Z_]+$/.test(value.exclusionReason) ? value.exclusionReason : null;
  return {
    uidPresent: value.uidPresent === true,
    startDate,
    endDate,
    status: safeCalendarStatus(typeof value.status === "string" ? value.status : null),
    summaryPreview: safeCalendarSummaryPreview(typeof value.summaryPreview === "string" ? value.summaryPreview : null),
    descriptionPresent: value.descriptionPresent === true,
    classification: value.classification as CalendarEventClassification,
    exclusionReason: rawReason as CalendarEventExclusionReason | null,
  };
}

export function readCalendarSyncDiagnosticPayload(value: unknown, legacyUnknownDetails?: unknown): CalendarSyncDiagnosticPayload {
  if (isRecord(value)) {
    const events = Array.isArray(value.events) ? value.events.flatMap((item) => {
      const event = readDiagnosticEvent(item);
      return event ? [event] : [];
    }).slice(0, CALENDAR_EVENT_DIAGNOSTIC_LIMIT) : [];
    const exclusionReasonCounts = isRecord(value.exclusionReasonCounts)
      ? Object.fromEntries(Object.entries(value.exclusionReasonCounts).flatMap(([reason, count]) => (
          /^[A-Z_]+$/.test(reason) && typeof count === "number" && Number.isSafeInteger(count) && count > 0 ? [[reason, count]] : []
        )))
      : {};
    return {
      version: 1,
      events,
      truncatedEventCount: typeof value.truncatedEventCount === "number" && value.truncatedEventCount > 0 ? Math.trunc(value.truncatedEventCount) : 0,
      exclusionReasonCounts,
    };
  }

  const legacyEvents = Array.isArray(legacyUnknownDetails) ? legacyUnknownDetails.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      uidPresent: typeof item.uid === "string" && item.uid.length > 0,
      startDate: "",
      endDate: "",
      status: safeCalendarStatus(typeof item.status === "string" ? item.status : null),
      summaryPreview: safeCalendarSummaryPreview(typeof item.summary === "string" ? item.summary : null),
      descriptionPresent: typeof item.descriptionPreview === "string" && item.descriptionPreview.length > 0,
      classification: "UNKNOWN" as const,
      exclusionReason: "PROVIDER_CLASSIFIER_NO_MATCH" as const,
    }];
  }).slice(0, CALENDAR_EVENT_DIAGNOSTIC_LIMIT) : [];
  return { version: 1, events: legacyEvents, truncatedEventCount: 0, exclusionReasonCounts: {} };
}
