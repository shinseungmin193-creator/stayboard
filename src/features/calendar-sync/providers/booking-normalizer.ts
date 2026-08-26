import type { ReservationNormalizer } from "./reservation-normalizer";
import { normalizeCommon } from "./reservation-normalizer";
import { classifyBookingEvent } from "./booking-event-classifier";
export class BookingReservationNormalizer implements ReservationNormalizer { readonly provider = "BOOKING" as const; readonly classificationVersion = 2; classifyEvent = classifyBookingEvent; normalize = normalizeCommon; }
