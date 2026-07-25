import type { CalendarProviderType } from "@/providers/calendar/types";
import type { ParsedCalendarEvent } from "../domain/calendar-event";
import type { NormalizedReservation } from "../domain/normalized-reservation";
import type { CalendarEventClassification } from "../domain/calendar-event";

export interface ReservationNormalizer {
  readonly provider: CalendarProviderType;
  classifyEvent(event: ParsedCalendarEvent): CalendarEventClassification;
  normalize(event: ParsedCalendarEvent): NormalizedReservation;
}
export function mapIcsStatus(status: string | null): NormalizedReservation["status"] { switch (status?.toUpperCase()) { case "CONFIRMED": return "CONFIRMED"; case "CANCELLED": case "CANCELED": return "CANCELLED"; case "TENTATIVE": return "TENTATIVE"; default: return "UNKNOWN"; } }
export function normalizeCommon(event: ParsedCalendarEvent): NormalizedReservation { return { rawUid: event.uid, providerReservationId: event.uid, guestName: null, startDate: event.startDate, endDate: event.endDate, status: mapIcsStatus(event.status), summary: event.summary, description: event.description, providerCreatedAt: event.createdAt, providerUpdatedAt: event.lastModifiedAt }; }
