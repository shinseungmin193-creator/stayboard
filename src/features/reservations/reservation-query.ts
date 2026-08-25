import { shiftDateInput } from "../../lib/zoned-date";

export const RESERVATION_PRESERVED_QUERY_KEYS = ["propertyId", "roomId", "provider", "status", "dateField"] as const;
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function reservationDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day, weekday: KOREAN_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] };
}

export function reservationDateRangeLabel(from: string, to: string): string {
  const start = reservationDateParts(from);
  const startLabel = `${start.year}년 ${start.month}월 ${start.day}일`;
  if (from === to) return `${startLabel} (${start.weekday})`;
  const end = reservationDateParts(to);
  return `${startLabel} ~ ${end.year}년 ${end.month}월 ${end.day}일`;
}

export function shiftReservationDateInput(value: string, days: number): string {
  return shiftDateInput(value, days);
}

export function reservationDateHref(query: URLSearchParams, from: string, to: string): string {
  const copy = new URLSearchParams(query);
  copy.set("from", from);
  copy.set("to", to);
  copy.delete("page");
  return `/reservations?${copy}`;
}
