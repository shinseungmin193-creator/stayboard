export const CALENDAR_PROVIDER_TYPES = ["AIRBNB", "BOOKING", "AGODA"] as const;
export type CalendarProviderType = (typeof CALENDAR_PROVIDER_TYPES)[number];
export interface CalendarFetchResult { provider: CalendarProviderType; fetchedAt: Date; content: string; contentType: string | null; etag: string | null; lastModified: string | null }
export interface CalendarProvider { readonly type: CalendarProviderType; readonly displayName: string; supportsUrl(url: URL): boolean; fetchCalendar(input: { calendarUrl: string; signal?: AbortSignal }): Promise<CalendarFetchResult> }
