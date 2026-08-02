const CLEANING_TIME_ZONE_OFFSET = "+09:00";

export function getCleaningDateInput(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function parseCleaningDate(value: string | null | undefined, fallback = new Date()) {
  const dateInput = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getCleaningDateInput(fallback);
  const start = new Date(`${dateInput}T00:00:00${CLEANING_TIME_ZONE_OFFSET}`);
  if (!Number.isFinite(start.getTime())) return parseCleaningDate(getCleaningDateInput(fallback), fallback);
  return { dateInput, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function shiftCleaningDate(dateInput: string, days: number) {
  const { start } = parseCleaningDate(dateInput);
  return getCleaningDateInput(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}
