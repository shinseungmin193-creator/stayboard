export const locales = ["ko", "ja"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "ko";
export const localeCookieName = "stayboard-locale";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && locales.includes(value as AppLocale);
}
