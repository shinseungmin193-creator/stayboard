import type { CalendarProviderType } from "@/providers/calendar";

export interface CalendarFeedSafetyThresholds {
  enabled: boolean;
  maxUnknownRatio: number;
  minimumEventsForUnknownSpike: number;
  massDisappearanceRatio: number;
  minimumExistingReservationsForDisappearance: number;
  reservationSpikeMultiplier: number;
  minimumReservationSpikeDelta: number;
  conflictSpikeThreshold: number;
  minimumNewReservationsForConflictSpike: number;
  minimumProviderIdentityRatio: number;
  minimumEventsForNamespaceComparison: number;
}

export const DEFAULT_CALENDAR_FEED_SAFETY_THRESHOLDS: CalendarFeedSafetyThresholds = {
  enabled: false,
  maxUnknownRatio: 0.5,
  minimumEventsForUnknownSpike: 4,
  massDisappearanceRatio: 0.75,
  minimumExistingReservationsForDisappearance: 4,
  reservationSpikeMultiplier: 3,
  minimumReservationSpikeDelta: 5,
  conflictSpikeThreshold: 3,
  minimumNewReservationsForConflictSpike: 3,
  minimumProviderIdentityRatio: 0.8,
  minimumEventsForNamespaceComparison: 3,
};

const PROVIDER_OVERRIDES: Partial<Record<CalendarProviderType, Partial<CalendarFeedSafetyThresholds>>> = {
  BOOKING: { enabled: true },
};

export function getCalendarFeedSafetyThresholds(provider: CalendarProviderType): CalendarFeedSafetyThresholds {
  return { ...DEFAULT_CALENDAR_FEED_SAFETY_THRESHOLDS, ...PROVIDER_OVERRIDES[provider] };
}
