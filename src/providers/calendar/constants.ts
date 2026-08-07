export const ICS_DOWNLOAD_TIMEOUT_MS = 15_000;
export const ICS_DOWNLOAD_TOTAL_TIMEOUT_MS = 40_000;
export const ICS_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const ICS_MAX_REDIRECTS = 3;
export const ICS_DOWNLOAD_MAX_ATTEMPTS = 3;
export const ICS_RETRY_BASE_DELAY_MS = 400;
export const ICS_RETRY_MAX_DELAY_MS = 4_000;
export const ICS_MAX_VEVENTS = 10_000;
export const ICS_MAX_UID_LENGTH = 512;
export const ICS_MAX_SUMMARY_LENGTH = 2_000;
export const ICS_MAX_DESCRIPTION_LENGTH = 20_000;
export const ICS_MAX_INVALID_EVENT_RATIO = 0.5;
export const ALLOWED_CALENDAR_CONTENT_TYPES = ["text/calendar", "text/plain", "application/octet-stream"] as const;

export const PROVIDER_HOSTS = {
  AIRBNB: ["airbnb.com", "www.airbnb.com", "airbnb.jp", "www.airbnb.jp"],
  BOOKING: ["ical.booking.com"],
  // ycs.agoda.com currently redirects official exports to portal.agoda.com.
  AGODA: ["ycs.agoda.com", "portal.agoda.com"],
} as const;
