import { DEFAULT_TIMEZONE } from "./constants";

export function isValidDateInput(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function resolveTimeZone(timeZone = DEFAULT_TIMEZONE) {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function getZonedDateInput(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function getZonedMidnight(dateInput: string, timeZone = DEFAULT_TIMEZONE) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const localTimestamp = Date.UTC(year, month - 1, day);
  let instant = new Date(localTimestamp);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = formatter.formatToParts(instant);
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const zonedTimestamp = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    instant = new Date(instant.getTime() + localTimestamp - zonedTimestamp);
  }
  return instant;
}

export function shiftDateInput(dateInput: string, days: number) {
  const current = new Date(`${dateInput}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().slice(0, 10);
}

export function getZonedDayRange(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const dateInput = getZonedDateInput(now, timeZone);
  return {
    dateInput,
    start: getZonedMidnight(dateInput, timeZone),
    end: getZonedMidnight(shiftDateInput(dateInput, 1), timeZone),
    timeZone: resolveTimeZone(timeZone),
  };
}
