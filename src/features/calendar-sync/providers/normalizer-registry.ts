import type { CalendarProviderType } from "@/providers/calendar";
import type { ReservationNormalizer } from "./reservation-normalizer";
import { AirbnbReservationNormalizer } from "./airbnb-normalizer";
import { BookingReservationNormalizer } from "./booking-normalizer";
import { AgodaReservationNormalizer } from "./agoda-normalizer";
export class ReservationNormalizerRegistry { private readonly normalizers = new Map<CalendarProviderType, ReservationNormalizer>(); constructor(normalizers: readonly ReservationNormalizer[]) { normalizers.forEach((normalizer) => this.normalizers.set(normalizer.provider, normalizer)); } get(provider: CalendarProviderType) { const normalizer = this.normalizers.get(provider); if (!normalizer) throw new Error("지원하지 않는 예약 Provider입니다."); return normalizer; } }
export const reservationNormalizerRegistry = new ReservationNormalizerRegistry([new AirbnbReservationNormalizer(), new BookingReservationNormalizer(), new AgodaReservationNormalizer()]);
