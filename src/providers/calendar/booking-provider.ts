import type { CalendarProvider } from "./types";
import { fetchProviderCalendar, supportsProviderUrl } from "./provider-helpers";
export class BookingProvider implements CalendarProvider { readonly type = "BOOKING" as const; readonly displayName = "Booking.com"; supportsUrl(url: URL) { return supportsProviderUrl(this.type, url); } fetchCalendar({ calendarUrl, signal }: { calendarUrl: string; signal?: AbortSignal }) { return fetchProviderCalendar(this.type, calendarUrl, signal); } }
