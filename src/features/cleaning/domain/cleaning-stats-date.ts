import { getZonedDateInput, getZonedMidnight, isValidDateInput, shiftDateInput } from "../../../lib/zoned-date";
import { DEFAULT_CLEANING_TIME_ZONE } from "./cleaning-date";

export type CleaningStatsPreset = "today" | "this-week" | "this-month" | "custom";

function monthEnd(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return shiftDateInput(nextMonth, -1);
}

export function getCleaningStatsPresetRange(
  preset: Exclude<CleaningStatsPreset, "custom">,
  now = new Date(),
  timeZone = DEFAULT_CLEANING_TIME_ZONE,
) {
  const today = getZonedDateInput(now, timeZone);
  if (preset === "today") return { from: today, to: today };
  if (preset === "this-week") {
    const [year, month, day] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const monday = shiftDateInput(today, -((weekday + 6) % 7));
    return { from: monday, to: shiftDateInput(monday, 6) };
  }
  const from = `${today.slice(0, 7)}-01`;
  return { from, to: monthEnd(from) };
}

export function parseCleaningStatsRange(input: {
  from?: string | null;
  to?: string | null;
  now?: Date;
  timeZone?: string;
}) {
  const timeZone = input.timeZone ?? DEFAULT_CLEANING_TIME_ZONE;
  const fallback = getCleaningStatsPresetRange("this-month", input.now ?? new Date(), timeZone);
  const from = isValidDateInput(input.from) ? input.from : fallback.from;
  const requestedTo = isValidDateInput(input.to) ? input.to : fallback.to;
  const to = requestedTo < from ? from : requestedTo;
  return {
    from,
    to,
    start: getZonedMidnight(from, timeZone),
    toExclusive: getZonedMidnight(shiftDateInput(to, 1), timeZone),
    timeZone,
  };
}
