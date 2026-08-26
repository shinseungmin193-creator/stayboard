import type { ReservationNormalizer } from "./reservation-normalizer";
import { normalizeCommon } from "./reservation-normalizer";
import { classifyAirbnbEvent } from "./airbnb-event-classifier";
import { normalizeCalendarText } from "../lib/normalize-calendar-text";

const RESERVED_SUMMARY = "reserved";

export class AirbnbReservationNormalizer implements ReservationNormalizer {
  readonly provider = "AIRBNB" as const;
  readonly classificationVersion = 1;
  classifyEvent = classifyAirbnbEvent;

  normalize(event: Parameters<ReservationNormalizer["normalize"]>[0]) {
    const reservation = normalizeCommon(event);
    const summary = normalizeCalendarText(event.summary);
    if (summary === RESERVED_SUMMARY) return { ...reservation, summary: "Airbnb" };
    return reservation;
  }
}
