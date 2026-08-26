import type { CalendarProviderType } from "@/providers/calendar/types";
import type { ParsedCalendarEvent } from "../domain/calendar-event";
import type { NormalizedReservation } from "../domain/normalized-reservation";
import type { CalendarEventClassification } from "../domain/calendar-event";

export interface ReservationNormalizer {
  readonly provider: CalendarProviderType;
  readonly classificationVersion: number;
  classifyEvent(event: ParsedCalendarEvent): CalendarEventClassification;
  normalize(event: ParsedCalendarEvent): NormalizedReservation;
}

export function classifyStoredCalendarEvent(
  normalizer: ReservationNormalizer,
  reservation: Pick<NormalizedReservation, "rawUid" | "startDate" | "endDate" | "status" | "summary" | "description">,
): CalendarEventClassification {
  return normalizer.classifyEvent({
    uid: reservation.rawUid,
    startDate: reservation.startDate,
    endDate: reservation.endDate,
    status: reservation.status,
    summary: reservation.summary,
    description: reservation.description,
    createdAt: null,
    lastModifiedAt: null,
    sequence: 0,
    dtstamp: null,
    rawProperties: {},
  });
}
export function mapIcsStatus(status: string | null): NormalizedReservation["status"] { switch (status?.toUpperCase()) { case "CONFIRMED": return "CONFIRMED"; case "CANCELLED": case "CANCELED": return "CANCELLED"; case "TENTATIVE": return "TENTATIVE"; default: return "UNKNOWN"; } }
export function normalizeCommon(event: ParsedCalendarEvent): NormalizedReservation { return { rawUid: event.uid, providerReservationId: event.uid, guestName: null, startDate: event.startDate, endDate: event.endDate, status: mapIcsStatus(event.status), summary: event.summary, description: event.description, providerCreatedAt: event.createdAt, providerUpdatedAt: event.lastModifiedAt }; }
