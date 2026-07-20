import type { ReservationNormalizer } from "./reservation-normalizer";
import { normalizeCommon } from "./reservation-normalizer";
export class AgodaReservationNormalizer implements ReservationNormalizer { readonly provider = "AGODA" as const; normalize = normalizeCommon; }
