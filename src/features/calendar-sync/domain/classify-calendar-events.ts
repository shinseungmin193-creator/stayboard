import type { CalendarParseIssue, ParsedCalendarEvent } from "./calendar-event";
import type { NormalizedReservation } from "./normalized-reservation";
import type { ReservationNormalizer } from "../providers/reservation-normalizer";

export interface CalendarEventClassificationCounts {
  parsedEventCount: number;
  reservationEventCount: number;
  blockedEventCount: number;
  cancelledEventCount: number;
  unknownEventCount: number;
  skippedEventCount: number;
}

export interface UnknownCalendarEventDetail {
  uid: string;
  summary: string | null;
  descriptionPreview: string | null;
  status: string | null;
  reason: "PROVIDER_CLASSIFIER_NO_MATCH";
}

export const EMPTY_CALENDAR_EVENT_CLASSIFICATION_COUNTS: CalendarEventClassificationCounts = {
  parsedEventCount: 0,
  reservationEventCount: 0,
  blockedEventCount: 0,
  cancelledEventCount: 0,
  unknownEventCount: 0,
  skippedEventCount: 0,
};

export interface ClassifiedCalendarEvents extends CalendarEventClassificationCounts {
  reservations: NormalizedReservation[];
  blockedUids: string[];
  unknownUids: string[];
  unknownEvents: UnknownCalendarEventDetail[];
}

const UNKNOWN_EVENT_SAMPLE_LIMIT = 20;
const UNKNOWN_UID_MAX_LENGTH = 256;
const UNKNOWN_SUMMARY_MAX_LENGTH = 160;
const UNKNOWN_DESCRIPTION_MAX_LENGTH = 240;
const UNKNOWN_STATUS_MAX_LENGTH = 50;

function safePreview(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  const normalized = value.normalize("NFKC").replace(/[\p{Cc}\p{Cf}\s]+/gu, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function canCancelMissingReservations(issues: readonly CalendarParseIssue[], unknownEventCount: number): boolean {
  return unknownEventCount === 0 && issues.every((issue) => issue.reason === "DUPLICATE_UID");
}

export function classifyCalendarEvents(
  events: readonly ParsedCalendarEvent[],
  normalizer: ReservationNormalizer,
  parserExcludedCount = 0,
): ClassifiedCalendarEvents {
  const reservations = new Map<string, NormalizedReservation>();
  const blockedUids: string[] = [];
  const unknownUids: string[] = [];
  const unknownEvents: UnknownCalendarEventDetail[] = [];
  let reservationEventCount = 0;
  let blockedEventCount = 0;
  let cancelledEventCount = 0;
  let unknownEventCount = 0;

  for (const event of events) {
    const classification = normalizer.classifyEvent(event);
    if (classification === "BLOCKED") {
      blockedEventCount += 1;
      blockedUids.push(event.uid);
      continue;
    }
    if (classification === "UNKNOWN") {
      unknownEventCount += 1;
      unknownUids.push(event.uid);
      if (unknownEvents.length < UNKNOWN_EVENT_SAMPLE_LIMIT) {
        unknownEvents.push({
          uid: safePreview(event.uid, UNKNOWN_UID_MAX_LENGTH) ?? "",
          summary: safePreview(event.summary, UNKNOWN_SUMMARY_MAX_LENGTH),
          descriptionPreview: safePreview(event.description, UNKNOWN_DESCRIPTION_MAX_LENGTH),
          status: safePreview(event.status, UNKNOWN_STATUS_MAX_LENGTH),
          reason: "PROVIDER_CLASSIFIER_NO_MATCH",
        });
      }
      continue;
    }

    const reservation = normalizer.normalize(event);
    if (classification === "CANCELLED") {
      cancelledEventCount += 1;
      reservations.set(reservation.rawUid, { ...reservation, status: "CANCELLED" });
      continue;
    }
    reservationEventCount += 1;
    reservations.set(reservation.rawUid, reservation.status === "UNKNOWN" ? { ...reservation, status: "CONFIRMED" } : reservation);
  }

  return {
    parsedEventCount: events.length,
    reservationEventCount,
    blockedEventCount,
    cancelledEventCount,
    unknownEventCount,
    skippedEventCount: parserExcludedCount + blockedEventCount + unknownEventCount,
    reservations: [...reservations.values()],
    blockedUids,
    unknownUids,
    unknownEvents,
  };
}
