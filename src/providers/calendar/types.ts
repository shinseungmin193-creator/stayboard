export const CALENDAR_PROVIDER_TYPES = ["AIRBNB", "BOOKING", "AGODA"] as const;
export type CalendarProviderType = (typeof CALENDAR_PROVIDER_TYPES)[number];
export const CALENDAR_PROVIDER_LABELS = {
  AIRBNB: "Airbnb",
  BOOKING: "Booking.com",
  AGODA: "Agoda",
} as const satisfies Record<CalendarProviderType, string>;

const calendarProviderTypeSet = new Set<string>(CALENDAR_PROVIDER_TYPES);

export function isCalendarProviderType(value: string): value is CalendarProviderType {
  return calendarProviderTypeSet.has(value);
}

export function getCalendarProviderLabel(value: string): string | null {
  return isCalendarProviderType(value) ? CALENDAR_PROVIDER_LABELS[value] : null;
}
export interface CalendarFetchResult { provider: CalendarProviderType; fetchedAt: Date; content: string; contentType: string | null; etag: string | null; lastModified: string | null }
export type CalendarUrlValidationReason = "INVALID_PROTOCOL" | "UNSUPPORTED_HOST" | "INVALID_PATH" | "MISSING_CREDENTIAL" | "EMBEDDED_CREDENTIALS";
export type CalendarUrlValidationResult = { valid: true } | { valid: false; reason: CalendarUrlValidationReason };
export interface CalendarProvider { readonly type: CalendarProviderType; readonly displayName: string; supportsUrl(url: URL): boolean; validateSourceUrl(url: URL): CalendarUrlValidationResult; fetchCalendar(input: { calendarUrl: string; signal?: AbortSignal }): Promise<CalendarFetchResult> }
