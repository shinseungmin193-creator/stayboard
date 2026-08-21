import { getCalendarFeedSafetyThresholds } from "../../calendar-sync/calendar-feed-safety.constants";
import type { CalendarFeedFingerprint } from "../../calendar-sync/domain/calendar-feed-fingerprint";
import type { CalendarEventClassificationCounts } from "../../calendar-sync/domain/classify-calendar-events";
import type { CalendarProviderType } from "../../../providers/calendar";

export type CalendarFeedConnectionFailureReason = "PROVIDER_IDENTITY_MISMATCH" | "EVENT_CLASSIFICATION_FAILED";

export type CalendarFeedConnectionValidationResult =
  | { valid: true }
  | { valid: false; reason: CalendarFeedConnectionFailureReason };

function ratio(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

export function validateCalendarFeedConnection(input: {
  provider: CalendarProviderType;
  fetchedEventCount: number;
  counts: CalendarEventClassificationCounts;
  fingerprint: CalendarFeedFingerprint;
}): CalendarFeedConnectionValidationResult {
  if (input.fetchedEventCount === 0) return { valid: true };

  const thresholds = getCalendarFeedSafetyThresholds(input.provider);
  if (!thresholds.enabled) return { valid: true };

  if (input.fingerprint.providerIdentityRatio < thresholds.minimumProviderIdentityRatio) {
    return { valid: false, reason: "PROVIDER_IDENTITY_MISMATCH" };
  }

  const unknownRatio = ratio(input.counts.unknownEventCount, input.counts.parsedEventCount);
  if (
    input.counts.parsedEventCount >= thresholds.minimumEventsForUnknownSpike
    && unknownRatio >= thresholds.maxUnknownRatio
  ) {
    return { valid: false, reason: "EVENT_CLASSIFICATION_FAILED" };
  }

  return { valid: true };
}
