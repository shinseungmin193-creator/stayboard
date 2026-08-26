import type { ReservationNormalizer } from "./reservation-normalizer";
import { normalizeCommon } from "./reservation-normalizer";
import { classifyAgodaEvent } from "./agoda-event-classifier";
export class AgodaReservationNormalizer implements ReservationNormalizer { readonly provider = "AGODA" as const; readonly classificationVersion = 1; classifyEvent = classifyAgodaEvent; normalize = normalizeCommon; }
