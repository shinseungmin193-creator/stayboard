import { getZonedDateInput, getZonedMidnight, isValidDateInput, shiftDateInput } from "../../../../lib/zoned-date";
import type { OccupancyPeriod } from "./occupancy";
export type OccupancyPeriodKey = "this-month" | "next-month" | "last-30-days" | "custom";
export const OCCUPANCY_PERIOD_OPTIONS = [{ value: "this-month", label: "이번 달" }, { value: "next-month", label: "다음 달" }, { value: "last-30-days", label: "최근 30일" }, { value: "custom", label: "사용자 지정" }] as const;
const LAST_30_DAYS = 30; const MS_PER_CALENDAR_DAY = 86_400_000;
function shiftMonthStart(dateInput: string, months: number) {
  const [year, month] = dateInput.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}
function build(startInput: string, endExclusiveInput: string): OccupancyPeriod {
  const startDay = Date.parse(`${startInput}T00:00:00Z`);
  const endDay = Date.parse(`${endExclusiveInput}T00:00:00Z`);
  return {
    start: getZonedMidnight(startInput),
    endExclusive: getZonedMidnight(endExclusiveInput),
    startLabel: startInput,
    endLabel: shiftDateInput(endExclusiveInput, -1),
    nightCount: Math.max(0, Math.round((endDay - startDay) / MS_PER_CALENDAR_DAY)),
  };
}
export function resolveOccupancyPeriod(input: { period?: string; from?: string; to?: string }, now = new Date()): { key: OccupancyPeriodKey; period: OccupancyPeriod } {
  const today = getZonedDateInput(now);
  if (isValidDateInput(input.from) && isValidDateInput(input.to) && input.from <= input.to) {
    return { key: "custom", period: build(input.from, shiftDateInput(input.to, 1)) };
  }
  const thisMonth = `${today.slice(0, 7)}-01`;
  if (input.period === "next-month") {
    const nextMonth = shiftMonthStart(thisMonth, 1);
    return { key: "next-month", period: build(nextMonth, shiftMonthStart(nextMonth, 1)) };
  }
  if (input.period === "last-30-days") {
    return { key: "last-30-days", period: build(shiftDateInput(today, -(LAST_30_DAYS - 1)), shiftDateInput(today, 1)) };
  }
  return { key: "this-month", period: build(thisMonth, shiftMonthStart(thisMonth, 1)) };
}
