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
export interface CalendarProvider { readonly type: CalendarProviderType; readonly displayName: string; supportsUrl(url: URL): boolean; fetchCalendar(input: { calendarUrl: string; signal?: AbortSignal }): Promise<CalendarFetchResult> }
