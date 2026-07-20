import "server-only";
import ICAL from "ical.js";
import type { CalendarConnectionResult } from "./calendar-source.types";
import type { CalendarFetchResult } from "@/providers/calendar";

export class CalendarParseError extends Error { constructor() { super("ICS 다운로드에는 성공했지만 캘린더 내용을 분석하지 못했습니다."); this.name = "CalendarParseError"; } }
export function analyzeCalendar(result: CalendarFetchResult, responseTimeMs: number): CalendarConnectionResult {
  try { const component = new ICAL.Component(ICAL.parse(result.content)); if (component.name !== "vcalendar") throw new Error("not calendar"); const events = component.getAllSubcomponents("vevent"); return { provider: result.provider, responseTimeMs, fetchedAt: result.fetchedAt.toISOString(), contentType: result.contentType, eventCount: events.length, uidCount: events.filter((event) => Boolean(event.getFirstPropertyValue("uid"))).length, startCount: events.filter((event) => Boolean(event.getFirstPropertyValue("dtstart"))).length, endCount: events.filter((event) => Boolean(event.getFirstPropertyValue("dtend"))).length, summaryCount: events.filter((event) => Boolean(event.getFirstPropertyValue("summary"))).length }; }
  catch { throw new CalendarParseError(); }
}
