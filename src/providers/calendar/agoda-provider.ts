import type { CalendarProvider } from "./types";
import { fetchProviderCalendar, supportsProviderUrl, validateProviderUrl } from "./provider-helpers";
export class AgodaProvider implements CalendarProvider { readonly type = "AGODA" as const; readonly displayName = "Agoda"; supportsUrl(url: URL) { return supportsProviderUrl(this.type, url); } validateSourceUrl(url: URL) { return validateProviderUrl(this.type, url); } fetchCalendar({ calendarUrl, signal }: { calendarUrl: string; signal?: AbortSignal }) { return fetchProviderCalendar(this.type, calendarUrl, signal); } }
