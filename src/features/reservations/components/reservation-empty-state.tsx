"use client";import { useTranslations } from "next-intl";

import { CalendarRange, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReservationEmptyState({ hasAnyReservations, hasFilters, onReset }: {hasAnyReservations: boolean;hasFilters: boolean;onReset: () => void;}) {const i18n = useTranslations();
  const filtered = hasAnyReservations && hasFilters;
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-card px-5 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-xl border bg-muted/50"><CalendarRange className="size-5 text-muted-foreground" /></div>
      <h2 className="text-base font-semibold">{filtered ? i18n("auto.m0422") : i18n("auto.m0423")}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{filtered ? i18n("auto.m0424") : i18n("auto.m0425")}</p>
      {filtered && <Button type="button" variant="outline" className="mt-5 min-h-11" onClick={onReset}><RotateCcw />{i18n("auto.m0426")}</Button>}
    </div>);

}
