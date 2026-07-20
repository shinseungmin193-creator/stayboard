import type { ReservationNormalizer } from "./reservation-normalizer";
import { normalizeCommon } from "./reservation-normalizer";
export class AirbnbReservationNormalizer implements ReservationNormalizer { readonly provider = "AIRBNB" as const; normalize = normalizeCommon; }
