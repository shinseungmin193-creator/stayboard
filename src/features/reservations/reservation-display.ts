import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
import { getCalendarProviderLabel } from "../../providers/calendar/types";

export function getReservationDisplayName(reservation: {
  guestName: string | null;
  provider: CalendarProviderType;
  status: ReservationStatus;
}, fallback = "예약자 정보 없음") {
  if (reservation.guestName?.trim()) return reservation.guestName.trim();
  if (reservation.status === "BLOCKED") return fallback;
  return fallback;
}

export function getReservationDisplayLabel(reservation: Parameters<typeof getReservationDisplayName>[0], fallback = "예약자 정보 없음") {
  const name = getReservationDisplayName(reservation, fallback);
  const providerLabel = getCalendarProviderLabel(reservation.provider);
  if (reservation.status === "BLOCKED" || !providerLabel || name === fallback) return name;
  return `${name} · ${providerLabel}`;
}
