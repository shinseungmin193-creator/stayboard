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
