import type { ParsedCalendarEvent } from "../domain/calendar-event";
import { normalizeCalendarText } from "../lib/normalize-calendar-text";
import { calendarProperty, hasProviderDomain, isCancelledCalendarEvent, matchesCalendarText } from "./event-classification";

const BOOKING_DOMAIN = "booking.com";
const BOOKING_EXPLICIT_BLOCKED_SUMMARIES = new Set([
  "blocked",
  "closed not available",
  "closed",
  "not available",
  "unavailable",
  "owner use",
  "maintenance",
  "stop sell",
  "room closed",
  "restrictions",
  "calendar blocked",
  "owner block",
  "owner blocked",
]);
const BOOKING_RESERVATION_SUMMARIES = new Set(["reserved", "reservation", "booking", "booking reservation"]);

export function classifyBookingEvent(event: ParsedCalendarEvent) {
  if (isCancelledCalendarEvent(event)) return "CANCELLED" as const;
  if (matchesCalendarText(event.summary, BOOKING_EXPLICIT_BLOCKED_SUMMARIES)) return "BLOCKED" as const;

  const organizer = calendarProperty(event, "organizer");
  const hasBookingIdentity = hasProviderDomain(event.uid, BOOKING_DOMAIN) || hasProviderDomain(organizer, BOOKING_DOMAIN);
  const summary = normalizeCalendarText(event.summary);
  if (summary && hasBookingIdentity) return "RESERVATION" as const;
  if (matchesCalendarText(event.summary, BOOKING_RESERVATION_SUMMARIES)) return "RESERVATION" as const;
  return "UNKNOWN" as const;
}
