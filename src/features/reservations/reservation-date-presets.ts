import { getZonedDateInput, shiftDateInput } from "../../lib/zoned-date";

export type ReservationDatePreset = "today" | "this-week" | "this-month" | "custom";

export interface ReservationDateRange {
  from: string;
  to: string;
}

export function getReservationDatePresetRange(preset: Exclude<ReservationDatePreset, "custom">, now = new Date()): ReservationDateRange {
  const today = getZonedDateInput(now);
  if (preset === "today") {
    return { from: today, to: today };
  }
  if (preset === "this-week") {
    const [year, month, day] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;
    const monday = shiftDateInput(today, -daysSinceMonday);
    return {
      from: monday,
      to: shiftDateInput(monday, 6),
    };
  }
  const monthStart = `${today.slice(0, 7)}-01`;
  const [year, month] = monthStart.split("-").map(Number);
  const nextMonthStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return {
    from: monthStart,
    to: shiftDateInput(nextMonthStart, -1),
  };
}
