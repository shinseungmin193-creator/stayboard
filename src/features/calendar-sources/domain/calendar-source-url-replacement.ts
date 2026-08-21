import type { CalendarProviderType } from "../../../providers/calendar";
import type { CalendarFeedFingerprint } from "../../calendar-sync/domain/calendar-feed-fingerprint";
import type { CalendarFeedSafetyDiagnostics } from "../../calendar-sync/domain/calendar-feed-safety";

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
  companyId: string;
  provider: CalendarProviderType;
  calendarUrl: string;
  fingerprint: CalendarFeedFingerprint;
  syncSafetyStatus: "SAFE" | "QUARANTINED";
  safetyDiagnostics: CalendarFeedSafetyDiagnostics;
  baselineAt: Date;
}

export async function prepareCalendarSourceUrlReplacement(
  input: { calendarSourceId: string; expectedRoomId: string; submittedUrl: string },
  dependencies: {
    findSource: (id: string) => Promise<{ id: string; roomId: string; companyId: string; provider: CalendarProviderType; calendarUrl: string } | null>;
    validateUrl: (provider: CalendarProviderType, value: string) => string;
    hasDuplicate: (roomId: string, calendarUrl: string, excludeId: string) => Promise<boolean>;
    inspect: (provider: CalendarProviderType, calendarUrl: string, sourceId: string) => Promise<{
      normalizedUrl: string;
      fingerprint: CalendarFeedFingerprint;
      syncSafetyStatus: "SAFE" | "QUARANTINED";
      safetyDiagnostics: CalendarFeedSafetyDiagnostics;
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
    companyId: source.companyId,
    provider: source.provider,
    calendarUrl: inspected.normalizedUrl,
    fingerprint: inspected.fingerprint,
    syncSafetyStatus: inspected.syncSafetyStatus,
    safetyDiagnostics: inspected.safetyDiagnostics,
    baselineAt: inspected.fetchedAt,
  };
}
