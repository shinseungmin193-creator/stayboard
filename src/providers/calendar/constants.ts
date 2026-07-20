export const CALENDAR_FETCH_TIMEOUT_MS = 15_000;
export const CALENDAR_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const CALENDAR_MAX_REDIRECTS = 3;
export const ALLOWED_CALENDAR_CONTENT_TYPES = ["text/calendar", "text/plain", "application/octet-stream"] as const;

export const PROVIDER_HOSTS = {
  AIRBNB: ["airbnb.com", "www.airbnb.com", "airbnb.jp", "www.airbnb.jp"],
  BOOKING: ["ical.booking.com"],
  AGODA: ["ycs.agoda.com"],
} as const;
