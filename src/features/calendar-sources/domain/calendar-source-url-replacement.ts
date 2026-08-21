import type { CalendarProviderType } from "../../../providers/calendar";
import type { CalendarFeedFingerprint } from "../../calendar-sync/domain/calendar-feed-fingerprint";
import type { CalendarFeedSafetyDiagnostics } from "../../calendar-sync/domain/calendar-feed-safety";
import type { CalendarEventClassificationCounts, UnknownCalendarEventDetail } from "../../calendar-sync/domain/classify-calendar-events";
import type { CalendarSyncDiagnosticPayload } from "../../calendar-sync/domain/calendar-sync-diagnostics";
import type { NormalizedReservation } from "../../calendar-sync/domain/normalized-reservation";

export type CalendarSourceUrlReplacementPreparationErrorCode = "NOT_FOUND" | "SCOPE_CHANGED" | "DUPLICATE" | "UNCHANGED";

export class CalendarSourceUrlReplacementPreparationError extends Error {
  constructor(readonly code: CalendarSourceUrlReplacementPreparationErrorCode) {
    super(code);
    this.name = "CalendarSourceUrlReplacementPreparationError";
  }
}

export interface PreparedCalendarSourceUrlReplacement {
  calendarSourceId: string;
  roomId: string;
  propertyId: string;
  companyId: string;
  provider: CalendarProviderType;
  previousCalendarUrl: string;
  calendarUrl: string;
  fingerprint: CalendarFeedFingerprint;
  safetyDiagnostics: CalendarFeedSafetyDiagnostics;
  fetchedCount: number;
  eventCounts: CalendarEventClassificationCounts;
  reservations: NormalizedReservation[];
  unknownEvents: UnknownCalendarEventDetail[];
  eventDiagnostics: CalendarSyncDiagnosticPayload;
  warning: boolean;
  baselineAt: Date;
}

export function planCalendarSourceReservationReplacement(
  calendarSourceId: string,
  existingReservations: readonly { id: string; calendarSourceId: string }[],
  incomingReservations: readonly NormalizedReservation[],
) {
  return {
    removeReservationIds: existingReservations
      .filter((reservation) => reservation.calendarSourceId === calendarSourceId)
      .map((reservation) => reservation.id),
    createReservations: incomingReservations.filter((reservation) => reservation.status !== "CANCELLED"),
  };
}

export async function prepareCalendarSourceUrlReplacement(
  input: { calendarSourceId: string; expectedRoomId: string; submittedUrl: string },
  dependencies: {
    findSource: (id: string) => Promise<{ id: string; roomId: string; propertyId: string; companyId: string; provider: CalendarProviderType; calendarUrl: string } | null>;
    validateUrl: (provider: CalendarProviderType, value: string) => string;
    hasDuplicate: (roomId: string, calendarUrl: string, excludeId: string) => Promise<boolean>;
    inspect: (provider: CalendarProviderType, calendarUrl: string, sourceId: string) => Promise<{
      normalizedUrl: string;
      fingerprint: CalendarFeedFingerprint;
      safetyDiagnostics: CalendarFeedSafetyDiagnostics;
      fetchedCount: number;
      eventCounts: CalendarEventClassificationCounts;
      reservations: NormalizedReservation[];
      unknownEvents: UnknownCalendarEventDetail[];
      eventDiagnostics: CalendarSyncDiagnosticPayload;
      warning: boolean;
      fetchedAt: Date;
    }>;
  },
): Promise<PreparedCalendarSourceUrlReplacement> {
  const source = await dependencies.findSource(input.calendarSourceId);
  if (!source) throw new CalendarSourceUrlReplacementPreparationError("NOT_FOUND");
  if (source.roomId !== input.expectedRoomId) throw new CalendarSourceUrlReplacementPreparationError("SCOPE_CHANGED");
  const normalizedUrl = dependencies.validateUrl(source.provider, input.submittedUrl);
  if (normalizedUrl === source.calendarUrl) throw new CalendarSourceUrlReplacementPreparationError("UNCHANGED");
  if (await dependencies.hasDuplicate(source.roomId, normalizedUrl, source.id)) throw new CalendarSourceUrlReplacementPreparationError("DUPLICATE");
  const inspected = await dependencies.inspect(source.provider, normalizedUrl, source.id);
  return {
    calendarSourceId: source.id,
    roomId: source.roomId,
    propertyId: source.propertyId,
    companyId: source.companyId,
    provider: source.provider,
    previousCalendarUrl: source.calendarUrl,
    calendarUrl: inspected.normalizedUrl,
    fingerprint: inspected.fingerprint,
    safetyDiagnostics: inspected.safetyDiagnostics,
    fetchedCount: inspected.fetchedCount,
    eventCounts: inspected.eventCounts,
    reservations: inspected.reservations,
    unknownEvents: inspected.unknownEvents,
    eventDiagnostics: inspected.eventDiagnostics,
    warning: inspected.warning,
    baselineAt: inspected.fetchedAt,
  };
}
