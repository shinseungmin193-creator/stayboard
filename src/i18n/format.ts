import type { AppLocale } from "./config";

const localeTags: Record<AppLocale, string> = {
  ko: "ko-KR",
  ja: "ja-JP",
};

export function getLocaleTag(locale: AppLocale) {
  return localeTags[locale];
}

export function formatLocalizedDate(
  value: Date | string | number,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(getLocaleTag(locale), options).format(new Date(value));
}
