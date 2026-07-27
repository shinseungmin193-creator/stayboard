import type { CalendarEventClassification, ParsedCalendarEvent } from "../domain/calendar-event";
import { normalizeCalendarText } from "../lib/normalize-calendar-text";

const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);

export type CalendarEventClassifier = (event: ParsedCalendarEvent) => CalendarEventClassification;

export function isCancelledCalendarEvent(event: ParsedCalendarEvent): boolean {
  return CANCELLED_STATUSES.has(normalizeCalendarText(event.status));
}

export function matchesCalendarText(value: string | null, patterns: ReadonlySet<string>): boolean {
  return patterns.has(normalizeCalendarText(value));
}

export function calendarProperty(event: ParsedCalendarEvent, name: string): string {
  return normalizeCalendarText(event.rawProperties[name.toLocaleLowerCase("en-US")] ?? null);
}

export function hasProviderDomain(value: string, providerDomain: string): boolean {
  const normalized = normalizeCalendarText(value);
  return normalized.endsWith(`@${providerDomain}`)
    || normalized.includes(`@${providerDomain}:`)
    || normalized.includes(`://${providerDomain}/`)
    || normalized.includes(`://${providerDomain}:`);
}
