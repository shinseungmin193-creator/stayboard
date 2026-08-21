import type { ParsedCalendarEvent } from "./calendar-event";
import type { NormalizedReservation } from "./normalized-reservation";
import type { ReservationNormalizer } from "../providers/reservation-normalizer";
import { CALENDAR_EVENT_DIAGNOSTIC_LIMIT, createCalendarEventDiagnostic, safeCalendarStatus, safeCalendarSummaryPreview, type CalendarEventDiagnostic } from "./calendar-sync-diagnostics";

export interface CalendarEventClassificationCounts {
  parsedEventCount: number;
  reservationEventCount: number;
  blockedEventCount: number;
  cancelledEventCount: number;
  unknownEventCount: number;
  failedEventCount: number;
  skippedEventCount: number;
}

export interface UnknownCalendarEventDetail {
  uidPresent: boolean;
  summaryPreview: string | null;
  descriptionPresent: boolean;
  status: string | null;
  reason: "PROVIDER_CLASSIFIER_NO_MATCH";
}

export const EMPTY_CALENDAR_EVENT_CLASSIFICATION_COUNTS: CalendarEventClassificationCounts = {
  parsedEventCount: 0,
  reservationEventCount: 0,
  blockedEventCount: 0,
  cancelledEventCount: 0,
  unknownEventCount: 0,
  failedEventCount: 0,
  skippedEventCount: 0,
};

export interface ClassifiedCalendarEvents extends CalendarEventClassificationCounts {
  reservations: NormalizedReservation[];
  observedUids: string[];
  blockedUids: string[];
  unknownUids: string[];
  unknownEvents: UnknownCalendarEventDetail[];
  eventDiagnostics: CalendarEventDiagnostic[];
  eventDiagnosticTruncatedCount: number;
}

const UNKNOWN_EVENT_SAMPLE_LIMIT = 20;

export function classifyCalendarEvents(
  events: readonly ParsedCalendarEvent[],
  normalizer: ReservationNormalizer,
  parserExcludedCount = 0,
  failedEventCount = parserExcludedCount,
): ClassifiedCalendarEvents {
  const reservations = new Map<string, NormalizedReservation>();
  const blockedUids: string[] = [];
  const unknownUids: string[] = [];
  const unknownEvents: UnknownCalendarEventDetail[] = [];
  const eventDiagnostics: CalendarEventDiagnostic[] = [];
  let reservationEventCount = 0;
  let blockedEventCount = 0;
  let cancelledEventCount = 0;
  let unknownEventCount = 0;

  for (const event of events) {
    const classification = normalizer.classifyEvent(event);
    if (eventDiagnostics.length < CALENDAR_EVENT_DIAGNOSTIC_LIMIT) eventDiagnostics.push(createCalendarEventDiagnostic(event, classification));
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
          uidPresent: Boolean(event.uid),
          summaryPreview: safeCalendarSummaryPreview(event.summary),
          descriptionPresent: Boolean(event.description),
          status: safeCalendarStatus(event.status),
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
    failedEventCount,
    skippedEventCount: parserExcludedCount + blockedEventCount + unknownEventCount,
    reservations: [...reservations.values()],
    observedUids: [...new Set(events.map((event) => event.uid))],
    blockedUids,
    unknownUids,
    unknownEvents,
    eventDiagnostics,
    eventDiagnosticTruncatedCount: Math.max(0, events.length - eventDiagnostics.length),
  };
}
