import type { ParsedCalendarEvent } from "../domain/calendar-event";
import { normalizeCalendarText } from "../lib/normalize-calendar-text";
import { isCancelledCalendarEvent, matchesCalendarText } from "./event-classification";

const AIRBNB_BLOCKED_SUMMARIES = new Set([
  "blocked",
  "not available",
  "airbnb (not available)",
  "unavailable",
  "closed",
  "owner block",
  "owner blocked",
  "maintenance",
  "calendar blocked",
]);
const AIRBNB_CANCELLED_SIGNALS = new Set(["cancelled", "canceled", "reservation cancelled", "reservation canceled"]);
const AIRBNB_RESERVATION_SUMMARIES = new Set(["reserved"]);

export function classifyAirbnbEvent(event: ParsedCalendarEvent) {
  if (isCancelledCalendarEvent(event, AIRBNB_CANCELLED_SIGNALS)) return "CANCELLED" as const;
  if (matchesCalendarText(event.summary, AIRBNB_BLOCKED_SUMMARIES)) return "BLOCKED" as const;
  const description = normalizeCalendarText(event.description);
  if (matchesCalendarText(event.summary, AIRBNB_RESERVATION_SUMMARIES)) return "RESERVATION" as const;
  if (description.includes("airbnb") && description.includes("reservation")) return "RESERVATION" as const;
  if (normalizeCalendarText(event.summary) === "airbnb") return "BLOCKED" as const;
  return "UNKNOWN" as const;
}
