const CALENDAR_SEPARATOR_PATTERN = /[\s\p{Pd}_]+/gu;

export function normalizeCalendarText(value: string | null): string {
  return value?.normalize("NFKC").trim().replace(CALENDAR_SEPARATOR_PATTERN, " ").toLocaleLowerCase("en-US") ?? "";
}
