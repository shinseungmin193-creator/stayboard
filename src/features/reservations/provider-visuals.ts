export const PROVIDER_VISUALS = {
  AIRBNB: { label: "Airbnb", shortLabel: "Airbnb", className: "border-rose-400 bg-rose-100 text-rose-950 dark:border-rose-600 dark:bg-rose-950 dark:text-rose-100" },
  BOOKING: { label: "Booking.com", shortLabel: "Booking", className: "border-blue-400 bg-blue-100 text-blue-950 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-100" },
  AGODA: { label: "Agoda", shortLabel: "Agoda", className: "border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-100" },
  EXPEDIA: { label: "Expedia", shortLabel: "Expedia", className: "border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100" },
  VRBO: { label: "Vrbo", shortLabel: "Vrbo", className: "border-teal-400 bg-teal-100 text-teal-950 dark:border-teal-600 dark:bg-teal-950 dark:text-teal-100" },
  OTHER: { label: "Other", shortLabel: "Other", className: "border-slate-400 bg-slate-100 text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" },
} as const;

export const RESERVATION_CONFLICT_VISUAL = "ring-2 ring-destructive/70 border-destructive";

export function getProviderVisual(provider: string | null | undefined) {
  return provider && provider in PROVIDER_VISUALS
    ? PROVIDER_VISUALS[provider as keyof typeof PROVIDER_VISUALS]
    : PROVIDER_VISUALS.OTHER;
}

export function getProviderLabel(provider: string | null | undefined, translate: (key: string) => string) {
  return provider && provider in PROVIDER_VISUALS && provider !== "OTHER"
    ? PROVIDER_VISUALS[provider as Exclude<keyof typeof PROVIDER_VISUALS, "OTHER">].label
    : translate("provider.other");
}

export function getReservationBarLabel(provider: string | null | undefined, width: number, translate?: (key: string, values?: { provider: string }) => string) {
  const visual = getProviderVisual(provider);
  const label = translate ? getProviderLabel(provider, translate) : visual.label;
  if (width < 96) return translate ? label : visual.shortLabel;
  return translate ? translate("provider.reservation", { provider: label }) : `${label} 예약`;
}
