import { DEFAULT_TIMEZONE } from "../../../lib/constants";
import { getZonedDateInput, getZonedMidnight, getZonedDayRange, isValidDateInput, resolveTimeZone, shiftDateInput } from "../../../lib/zoned-date";

export const DEFAULT_CLEANING_TIME_ZONE = DEFAULT_TIMEZONE;

export function getCleaningDateInput(now = new Date(), timeZone = DEFAULT_CLEANING_TIME_ZONE) {
  return getZonedDateInput(now, timeZone);
}

export function parseCleaningDate(value: string | null | undefined, fallback = new Date(), timeZone = DEFAULT_CLEANING_TIME_ZONE) {
  const fallbackInput = getCleaningDateInput(fallback, timeZone);
  const dateInput = isValidDateInput(value) ? value : fallbackInput;
  const { start, end } = dateInput === fallbackInput
    ? getZonedDayRange(fallback, timeZone)
    : { start: getZonedMidnight(dateInput, timeZone), end: getZonedMidnight(shiftDateInput(dateInput, 1), timeZone) };
  return { dateInput, start, end, timeZone: resolveTimeZone(timeZone) };
}

export function shiftCleaningDate(dateInput: string, days: number) {
  return shiftDateInput(parseCleaningDate(dateInput).dateInput, days);
}

export function formatCleaningDateTimeInput(value: string | Date | null | undefined, timeZone = DEFAULT_CLEANING_TIME_ZONE) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function parseCleaningDateTimeInput(value: string, timeZone = DEFAULT_CLEANING_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (!isValidDateInput(`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`)
    || hour > 23 || minute > 59) return null;
  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(localTimestamp);
  const resolvedTimeZone = resolveTimeZone(timeZone);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const formatted = formatCleaningDateTimeInput(instant, resolvedTimeZone);
    const formattedMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(formatted);
    if (!formattedMatch) return null;
    const [, formattedYear, formattedMonth, formattedDay, formattedHour, formattedMinute] = formattedMatch.map(Number);
    const zonedTimestamp = Date.UTC(formattedYear, formattedMonth - 1, formattedDay, formattedHour, formattedMinute);
    instant = new Date(instant.getTime() + localTimestamp - zonedTimestamp);
  }
  return formatCleaningDateTimeInput(instant, resolvedTimeZone) === value ? instant : null;
}

export function formatCleaningSelectedDate({
  date,
  locale,
  timeZone = DEFAULT_CLEANING_TIME_ZONE,
}: {
  date: string;
  locale: string;
  timeZone?: string;
}) {
  const parsed = parseCleaningDate(date, new Date(0), timeZone);
  const localeTag = locale === "ja" || locale.startsWith("ja-") ? "ja-JP" : "ko-KR";
  const parts = new Intl.DateTimeFormat(localeTag, {
    timeZone: parsed.timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(parsed.start);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const weekday = value("weekday");
  return localeTag === "ja-JP"
    ? `${year}年${month}月${day}日（${weekday}）`
    : `${year}년 ${month}월 ${day}일 (${weekday})`;
}
