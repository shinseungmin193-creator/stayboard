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
const BOOKING_CANCELLED_SIGNALS = new Set(["cancelled", "canceled", "booking cancelled", "booking canceled"]);
const BOOKING_RESERVATION_SUMMARIES = new Set(["reserved", "reservation", "booking", "booking reservation"]);

export function classifyBookingEvent(event: ParsedCalendarEvent) {
  if (isCancelledCalendarEvent(event, BOOKING_CANCELLED_SIGNALS)) return "CANCELLED" as const;
  if (matchesCalendarText(event.summary, BOOKING_EXPLICIT_BLOCKED_SUMMARIES)) return "BLOCKED" as const;

  const organizer = calendarProperty(event, "organizer");
  const hasBookingIdentity = hasProviderDomain(event.uid, BOOKING_DOMAIN) || hasProviderDomain(organizer, BOOKING_DOMAIN);
  const hasConfirmedStatus = normalizeCalendarText(event.status) === "confirmed";
  const summary = normalizeCalendarText(event.summary);
  const description = normalizeCalendarText(event.description);
  if (summary && hasBookingIdentity) return "RESERVATION" as const;
  if (matchesCalendarText(event.summary, BOOKING_RESERVATION_SUMMARIES)) return "RESERVATION" as const;
  if (summary && hasConfirmedStatus) return "RESERVATION" as const;
  if (description.includes("booking") && description.includes("reservation")) return "RESERVATION" as const;
  return "UNKNOWN" as const;
}
