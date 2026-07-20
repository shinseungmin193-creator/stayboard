import type { CalendarProvider } from "./types";
import { fetchProviderCalendar, supportsProviderUrl } from "./provider-helpers";
export class AgodaProvider implements CalendarProvider { readonly type = "AGODA" as const; readonly displayName = "Agoda"; supportsUrl(url: URL) { return supportsProviderUrl(this.type, url); } fetchCalendar({ calendarUrl, signal }: { calendarUrl: string; signal?: AbortSignal }) { return fetchProviderCalendar(this.type, calendarUrl, signal); } }
