import type { ReservationNormalizer } from "./reservation-normalizer";
import { normalizeCommon } from "./reservation-normalizer";
export class BookingReservationNormalizer implements ReservationNormalizer { readonly provider = "BOOKING" as const; normalize = normalizeCommon; }
