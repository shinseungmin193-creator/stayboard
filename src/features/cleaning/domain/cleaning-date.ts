const DEFAULT_CLEANING_TIME_ZONE = "Asia/Tokyo";

function safeTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    return DEFAULT_CLEANING_TIME_ZONE;
  }
}

function zonedMidnight(dateInput: string, timeZone: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const localTimestamp = Date.UTC(year, month - 1, day);
  let instant = new Date(localTimestamp);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
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

export function getCleaningDateInput(now = new Date(), timeZone = DEFAULT_CLEANING_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function parseCleaningDate(value: string | null | undefined, fallback = new Date(), timeZone = DEFAULT_CLEANING_TIME_ZONE) {
  const fallbackInput = getCleaningDateInput(fallback, timeZone);
  const requestedInput = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallbackInput;
  const parsed = new Date(`${requestedInput}T00:00:00Z`);
  const dateInput = Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === requestedInput
    ? requestedInput
    : fallbackInput;
  const start = zonedMidnight(dateInput, timeZone);
  const nextDateInput = new Date(`${dateInput}T00:00:00Z`);
  nextDateInput.setUTCDate(nextDateInput.getUTCDate() + 1);
  const end = zonedMidnight(nextDateInput.toISOString().slice(0, 10), timeZone);
  return { dateInput, start, end, timeZone: safeTimeZone(timeZone) };
}

export function shiftCleaningDate(dateInput: string, days: number) {
  const current = new Date(`${parseCleaningDate(dateInput).dateInput}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().slice(0, 10);
}
