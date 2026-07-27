export const PROVIDER_VISUALS = {
  AIRBNB: { label: "Airbnb", shortLabel: "Airbnb", className: "border-rose-400 bg-rose-100 text-rose-950 dark:border-rose-600 dark:bg-rose-950 dark:text-rose-100" },
  BOOKING: { label: "Booking.com", shortLabel: "Booking", className: "border-blue-400 bg-blue-100 text-blue-950 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-100" },
  AGODA: { label: "Agoda", shortLabel: "Agoda", className: "border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-100" },
  EXPEDIA: { label: "Expedia", shortLabel: "Expedia", className: "border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100" },
  VRBO: { label: "Vrbo", shortLabel: "Vrbo", className: "border-teal-400 bg-teal-100 text-teal-950 dark:border-teal-600 dark:bg-teal-950 dark:text-teal-100" },
  OTHER: { label: "기타", shortLabel: "기타", className: "border-slate-400 bg-slate-100 text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" },
} as const;

export const RESERVATION_CONFLICT_VISUAL = "ring-2 ring-destructive/70 border-destructive";

export function getProviderVisual(provider: string | null | undefined) {
  return provider && provider in PROVIDER_VISUALS
    ? PROVIDER_VISUALS[provider as keyof typeof PROVIDER_VISUALS]
    : PROVIDER_VISUALS.OTHER;
}

export function getReservationBarLabel(provider: string | null | undefined, width: number) {
  const visual = getProviderVisual(provider);
  return width >= 96 ? `${visual.label} 예약` : visual.shortLabel;
}
