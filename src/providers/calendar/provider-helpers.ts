import type { CalendarProviderType } from "./types";
import { fetchCalendarDocument } from "./http-client";
import { validateProviderUrl } from "./provider-url-policy";

export { supportsProviderUrl, validateProviderUrl } from "./provider-url-policy";
export function fetchProviderCalendar(provider: CalendarProviderType, calendarUrl: string, signal?: AbortSignal) { return fetchCalendarDocument({ provider, calendarUrl, signal, validateSourceUrl: (url) => validateProviderUrl(provider, url) }); }
