import type { ParsedCalendarEvent } from "../domain/calendar-event";
import { normalizeCalendarText } from "../lib/normalize-calendar-text";
import { calendarProperty, hasProviderDomain, isCancelledCalendarEvent, matchesCalendarText } from "./event-classification";

const BOOKING_DOMAIN = "booking.com";
const BOOKING_BLOCKED_SUMMARIES = new Set([
  "blocked",
  "closed",
  "not available",
  "unavailable",
  "owner use",
  "maintenance",
  "stop sell",
  "room closed",
  "restrictions",
  "closed not available",
  "calendar blocked",
  "owner block",
  "owner blocked",
]);
const BOOKING_CANCELLED_SIGNALS = new Set(["cancelled", "canceled", "booking cancelled", "booking canceled"]);

export function classifyBookingEvent(event: ParsedCalendarEvent) {
  if (isCancelledCalendarEvent(event, BOOKING_CANCELLED_SIGNALS)) return "CANCELLED" as const;
  if (matchesCalendarText(event.summary, BOOKING_BLOCKED_SUMMARIES)) return "BLOCKED" as const;

  const organizer = calendarProperty(event, "organizer");
  const hasBookingIdentity = hasProviderDomain(event.uid, BOOKING_DOMAIN) && hasProviderDomain(organizer, BOOKING_DOMAIN);
  const hasConfirmedStatus = normalizeCalendarText(event.status) === "confirmed";
  if (normalizeCalendarText(event.summary) && (hasBookingIdentity || hasConfirmedStatus)) return "RESERVATION" as const;
  return "UNKNOWN" as const;
}
