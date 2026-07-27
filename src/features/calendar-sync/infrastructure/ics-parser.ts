import ICAL from "ical.js";
import { ICS_MAX_DESCRIPTION_LENGTH, ICS_MAX_INVALID_EVENT_RATIO, ICS_MAX_SUMMARY_LENGTH, ICS_MAX_UID_LENGTH, ICS_MAX_VEVENTS } from "../../../providers/calendar/constants";
import type { CalendarParseIssue, CalendarParseResult, ParsedCalendarEvent } from "../domain/calendar-event";

export interface IcsDocumentParseDiagnostics { totalEventCount: number; parsedEventCount: number; issues: CalendarParseIssue[] }
export class IcsDocumentParseError extends Error {
  constructor(message = "ICS 문서 전체를 분석할 수 없습니다.", public readonly diagnostics?: IcsDocumentParseDiagnostics) {
    super(message);
    this.name = "IcsDocumentParseError";
  }
}
function text(event: ICAL.Component, name: string): string | null { const value = event.getFirstPropertyValue(name); return typeof value === "string" ? value.trim() || null : value == null ? null : String(value).trim() || null; }
function date(event: ICAL.Component, name: string): Date | null { const value = event.getFirstPropertyValue(name); if (!value || typeof value !== "object" || !("toJSDate" in value) || typeof value.toJSDate !== "function") return null; const result = value.toJSDate(); return Number.isNaN(result.getTime()) ? null : result; }
function sequence(event: ICAL.Component): number { const value = Number(event.getFirstPropertyValue("sequence") ?? 0); return Number.isSafeInteger(value) && value >= 0 ? value : 0; }
function propertyText(value: ReturnType<ICAL.Property["getFirstValue"]>): string | null { if (value == null) return null; const result = String(value).trim(); return result || null; }
function rawProperties(event: ICAL.Component): Readonly<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (const property of event.getAllProperties()) if (!(property.name in result)) result[property.name] = propertyText(property.getFirstValue());
  return Object.freeze(result);
}
function freshness(event: ParsedCalendarEvent): [number, number, number] { return [event.lastModifiedAt?.getTime() ?? Number.NEGATIVE_INFINITY, event.sequence, event.dtstamp?.getTime() ?? Number.NEGATIVE_INFINITY]; }
export function shouldReplaceDuplicateEvent(current: ParsedCalendarEvent, candidate: ParsedCalendarEvent): boolean { const left = freshness(current); const right = freshness(candidate); for (let index = 0; index < left.length; index += 1) { if (right[index] !== left[index]) return right[index] > left[index]; } return true; }

export function parseIcsCalendar(content: string): CalendarParseResult {
  let calendar: ICAL.Component; try { calendar = new ICAL.Component(ICAL.parse(content.replace(/^\uFEFF/, ""))); } catch { throw new IcsDocumentParseError(); }
  if (calendar.name !== "vcalendar") throw new IcsDocumentParseError();
  const components = calendar.getAllSubcomponents("vevent");
  if (components.length > ICS_MAX_VEVENTS) throw new IcsDocumentParseError(`VEVENT 수가 허용 한도 ${ICS_MAX_VEVENTS}개를 초과했습니다.`);
  const byUid = new Map<string, ParsedCalendarEvent>(); const issues: CalendarParseIssue[] = [];
  components.forEach((event, eventIndex) => {
    const uid = text(event, "uid"); if (!uid) { issues.push({ eventIndex, reason: "MISSING_UID" }); return; }
    if (uid.length > ICS_MAX_UID_LENGTH) { issues.push({ eventIndex, reason: "UID_TOO_LONG" }); return; }
    const startDate = date(event, "dtstart"); if (!startDate) { issues.push({ eventIndex, reason: "MISSING_START" }); return; }
    const endDate = date(event, "dtend"); if (!endDate) { issues.push({ eventIndex, reason: "MISSING_END" }); return; }
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) { issues.push({ eventIndex, reason: "INVALID_DATE" }); return; }
    if (endDate <= startDate) { issues.push({ eventIndex, reason: "INVALID_RANGE" }); return; }
    const summary = text(event, "summary"); if (summary && summary.length > ICS_MAX_SUMMARY_LENGTH) { issues.push({ eventIndex, reason: "SUMMARY_TOO_LONG" }); return; }
    const description = text(event, "description"); if (description && description.length > ICS_MAX_DESCRIPTION_LENGTH) { issues.push({ eventIndex, reason: "DESCRIPTION_TOO_LONG" }); return; }
    const parsed: ParsedCalendarEvent = { uid, startDate, endDate, summary, status: text(event, "status"), description, createdAt: date(event, "created"), lastModifiedAt: date(event, "last-modified"), sequence: sequence(event), dtstamp: date(event, "dtstamp"), rawProperties: rawProperties(event) };
    const current = byUid.get(uid); if (current) { issues.push({ eventIndex, reason: "DUPLICATE_UID" }); if (shouldReplaceDuplicateEvent(current, parsed)) byUid.set(uid, parsed); } else byUid.set(uid, parsed);
  });
  const invalidCount = issues.filter((issue) => issue.reason !== "DUPLICATE_UID").length;
  if (components.length > 0 && invalidCount / components.length > ICS_MAX_INVALID_EVENT_RATIO) {
    throw new IcsDocumentParseError("유효하지 않은 VEVENT 비율이 허용 범위를 초과했습니다.", { totalEventCount: components.length, parsedEventCount: byUid.size, issues });
  }
  return { totalEventCount: components.length, events: [...byUid.values()], excludedCount: issues.length, issues };
}
