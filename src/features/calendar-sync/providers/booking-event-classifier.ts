import type { ParsedCalendarEvent } from "../domain/calendar-event";
import { normalizeCalendarText } from "../lib/normalize-calendar-text";
import { calendarProperty, hasProviderDomain, isCancelledCalendarEvent, matchesCalendarText } from "./event-classification";

const BOOKING_DOMAIN = "booking.com";
const BOOKING_EXPLICIT_BLOCKED_SUMMARIES = new Set([
  "blocked",
  "owner use",
  "maintenance",
  "stop sell",
  "room closed",
  "restrictions",
  "calendar blocked",
  "owner block",
  "owner blocked",
]);
const BOOKING_OPAQUE_AVAILABILITY_SUMMARIES = new Set([
  "closed not available",
  "closed",
  "not available",
  "unavailable",
]);
const BOOKING_RESERVATION_SUMMARIES = new Set(["reserved", "reservation", "booking", "booking reservation"]);

function isBookingGeneratedUid(uid: string) {
  return /^[0-9a-f]{32}@booking\.com$/i.test(uid.trim());
}

export function classifyBookingEvent(event: ParsedCalendarEvent) {
  if (isCancelledCalendarEvent(event)) return "CANCELLED" as const;
  if (matchesCalendarText(event.summary, BOOKING_EXPLICIT_BLOCKED_SUMMARIES)) return "BLOCKED" as const;

  const organizer = calendarProperty(event, "organizer");
  const hasBookingOrganizer = hasProviderDomain(organizer, BOOKING_DOMAIN);
  if (matchesCalendarText(event.summary, BOOKING_OPAQUE_AVAILABILITY_SUMMARIES)) {
    return isBookingGeneratedUid(event.uid) && hasBookingOrganizer ? "RESERVATION" as const : "BLOCKED" as const;
  }

  const hasBookingIdentity = hasProviderDomain(event.uid, BOOKING_DOMAIN) || hasBookingOrganizer;
  const summary = normalizeCalendarText(event.summary);
  if (summary && hasBookingIdentity) return "RESERVATION" as const;
  if (matchesCalendarText(event.summary, BOOKING_RESERVATION_SUMMARIES)) return "RESERVATION" as const;
  return "UNKNOWN" as const;
}
