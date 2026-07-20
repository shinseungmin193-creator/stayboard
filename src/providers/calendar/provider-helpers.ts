import type { CalendarProviderType } from "./types";
import { PROVIDER_HOSTS } from "./constants";
import { fetchCalendarDocument } from "./http-client";

export function supportsProviderUrl(provider: CalendarProviderType, url: URL): boolean { return url.protocol === "https:" && (PROVIDER_HOSTS[provider] as readonly string[]).includes(url.hostname.toLowerCase()) && !url.username && !url.password; }
export function fetchProviderCalendar(provider: CalendarProviderType, calendarUrl: string, signal?: AbortSignal) { return fetchCalendarDocument({ provider, calendarUrl, signal, supportsUrl: (url) => supportsProviderUrl(provider, url) }); }
