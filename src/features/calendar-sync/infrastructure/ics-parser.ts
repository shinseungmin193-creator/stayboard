import ICAL from "ical.js";
import type { CalendarParseIssue, CalendarParseResult, ParsedCalendarEvent } from "../domain/calendar-event";

export class IcsDocumentParseError extends Error { constructor() { super("ICS 문서 전체를 분석할 수 없습니다."); this.name = "IcsDocumentParseError"; } }
function text(event: ICAL.Component, name: string): string | null { const value = event.getFirstPropertyValue(name); return typeof value === "string" ? value.trim() || null : value == null ? null : String(value).trim() || null; }
function date(event: ICAL.Component, name: string): Date | null { const value = event.getFirstPropertyValue(name); if (!value || typeof value !== "object" || !("toJSDate" in value) || typeof value.toJSDate !== "function") return null; const result = value.toJSDate(); return Number.isNaN(result.getTime()) ? null : result; }

export function parseIcsCalendar(content: string): CalendarParseResult {
  let calendar: ICAL.Component; try { calendar = new ICAL.Component(ICAL.parse(content.replace(/^\uFEFF/, ""))); } catch { throw new IcsDocumentParseError(); }
  if (calendar.name !== "vcalendar") throw new IcsDocumentParseError();
  const components = calendar.getAllSubcomponents("vevent"); const events: ParsedCalendarEvent[] = []; const issues: CalendarParseIssue[] = [];
  components.forEach((event, eventIndex) => { const uid = text(event, "uid"); if (!uid) { issues.push({ eventIndex, reason: "MISSING_UID" }); return; } const startDate = date(event, "dtstart"); if (!startDate) { issues.push({ eventIndex, reason: "MISSING_START" }); return; } const endDate = date(event, "dtend"); if (!endDate) { issues.push({ eventIndex, reason: "MISSING_END" }); return; } if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) { issues.push({ eventIndex, reason: "INVALID_DATE" }); return; } if (endDate <= startDate) { issues.push({ eventIndex, reason: "INVALID_RANGE" }); return; } events.push({ uid, startDate, endDate, summary: text(event, "summary"), status: text(event, "status"), description: text(event, "description"), createdAt: date(event, "created"), lastModifiedAt: date(event, "last-modified") }); });
  return { totalEventCount: components.length, events, excludedCount: issues.length, issues };
}
