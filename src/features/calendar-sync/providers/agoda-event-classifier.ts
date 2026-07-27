import type { ParsedCalendarEvent } from "../domain/calendar-event";
import { normalizeCalendarText } from "../lib/normalize-calendar-text";
import { calendarProperty, hasProviderDomain, isCancelledCalendarEvent, matchesCalendarText } from "./event-classification";

const AGODA_DOMAIN = "agoda.com";
const AGODA_BLOCKED_SUMMARIES = new Set([
  "blocked",
  "closed",
  "not available",
  "unavailable",
  "owner use",
  "maintenance",
  "stop sell",
  "closed not available",
  "calendar blocked",
  "owner block",
  "owner blocked",
]);
export function classifyAgodaEvent(event: ParsedCalendarEvent) {
  if (isCancelledCalendarEvent(event)) return "CANCELLED" as const;
  if (matchesCalendarText(event.summary, AGODA_BLOCKED_SUMMARIES)) return "BLOCKED" as const;

  const organizer = calendarProperty(event, "organizer");
  const hasAgodaIdentity = hasProviderDomain(event.uid, AGODA_DOMAIN) || hasProviderDomain(organizer, AGODA_DOMAIN);
  const hasConfirmedStatus = normalizeCalendarText(event.status) === "confirmed";
  if (normalizeCalendarText(event.summary) && (hasAgodaIdentity || hasConfirmedStatus)) return "RESERVATION" as const;
  return "UNKNOWN" as const;
}
