import type { CalendarProvider } from "./types";
import { fetchProviderCalendar, supportsProviderUrl } from "./provider-helpers";
export class AirbnbProvider implements CalendarProvider { readonly type = "AIRBNB" as const; readonly displayName = "Airbnb"; supportsUrl(url: URL) { return supportsProviderUrl(this.type, url); } fetchCalendar({ calendarUrl, signal }: { calendarUrl: string; signal?: AbortSignal }) { return fetchProviderCalendar(this.type, calendarUrl, signal); } }
