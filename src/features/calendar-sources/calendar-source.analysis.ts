import "server-only";
import ICAL from "ical.js";
import type { CalendarConnectionResult } from "./calendar-source.types";
import type { CalendarFetchResult } from "@/providers/calendar";
import { ICS_MAX_VEVENTS } from "@/providers/calendar/constants";

export type CalendarParseErrorCode = "PARSE" | "EVENT_LIMIT";
export class CalendarParseError extends Error { constructor(public readonly code: CalendarParseErrorCode = "PARSE", message = "ICS 다운로드에는 성공했지만 캘린더 내용을 분석하지 못했습니다.") { super(message); this.name = "CalendarParseError"; } }
export function analyzeCalendar(result: CalendarFetchResult, responseTimeMs: number): CalendarConnectionResult {
  try { const component = new ICAL.Component(ICAL.parse(result.content)); if (component.name !== "vcalendar") throw new Error("not calendar"); const events = component.getAllSubcomponents("vevent"); if (events.length > ICS_MAX_VEVENTS) throw new CalendarParseError("EVENT_LIMIT", "캘린더 이벤트 수가 허용 한도를 초과했습니다."); return { provider: result.provider, responseTimeMs, fetchedAt: result.fetchedAt.toISOString(), contentType: result.contentType, eventCount: events.length, uidCount: events.filter((event) => Boolean(event.getFirstPropertyValue("uid"))).length, startCount: events.filter((event) => Boolean(event.getFirstPropertyValue("dtstart"))).length, endCount: events.filter((event) => Boolean(event.getFirstPropertyValue("dtend"))).length, summaryCount: events.filter((event) => Boolean(event.getFirstPropertyValue("summary"))).length }; }
  catch (error) { if (error instanceof CalendarParseError) throw error; throw new CalendarParseError(); }
}
