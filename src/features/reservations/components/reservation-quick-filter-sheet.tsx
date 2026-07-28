"use client";import { useTranslations } from "next-intl";

import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ReservationFilterState } from "../reservation-filter-query";
import { applyQuickReservationFilter, type ReservationQuickFilter } from "../reservation-quick-filters";










export function ReservationQuickFilterSheet({ filters, onApply }: {filters: ReservationFilterState;onApply: (filters: ReservationFilterState) => void;}) {const i18n = useTranslations();const QUICK_FILTERS: Array<{value: ReservationQuickFilter;label: string;description: string;}> = [{ value: "today-check-in", label: i18n("reservation.statuses.CHECK_IN_TODAY"), description: i18n("auto.m0642") }, { value: "today-check-out", label: i18n("reservation.statuses.CHECK_OUT_TODAY"), description: i18n("auto.m0643") }, { value: "week-check-in", label: i18n("auto.m0644"), description: i18n("auto.m0645") }, { value: "week-check-out", label: i18n("auto.m0646"), description: i18n("auto.m0647") }, { value: "month-stays", label: i18n("auto.m0648"), description: i18n("auto.m0649") }, { value: "conflicts", label: i18n("auto.m0387"), description: i18n("auto.m0650") }];
  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={i18n("auto.m0446")} />}><Zap /></SheetTrigger>
      <SheetContent side="bottom" className="gap-0 overflow-hidden p-0" aria-label={i18n("auto.m0447")}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <SheetHeader className="border-b px-4 py-3 text-left"><SheetTitle>{i18n("auto.m0448")}</SheetTitle><SheetDescription>{i18n("auto.m0449")}</SheetDescription></SheetHeader>
        <div className="grid max-h-[60dvh] gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {QUICK_FILTERS.map((item) =>
          <SheetClose key={item.value} render={<button type="button" onClick={() => onApply(applyQuickReservationFilter(filters, item.value))} className="flex min-h-14 w-full items-center justify-between rounded-xl border bg-background px-3 py-2 text-left transition hover:bg-muted" />}>
              <span><strong className="block text-sm">{item.label}</strong><span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span></span><Zap className="size-4 text-muted-foreground" />
            </SheetClose>
          )}
        </div>
      </SheetContent>
    </Sheet>);

}
