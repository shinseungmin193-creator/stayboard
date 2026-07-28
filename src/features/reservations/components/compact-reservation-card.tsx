"use client";import { useTranslations, useLocale } from "next-intl";

import { differenceInCalendarDays } from "date-fns";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReservationViewModel } from "../reservation-view-model";
import { getReservationDisplayName } from "../reservation-display";
import { getProviderLabel, getProviderVisual } from "../provider-visuals";
import { ReservationStatusBadge } from "./reservation-status-badge";



function compactDate(value: string, localeTag: string) {const dateFormatter = new Intl.DateTimeFormat(localeTag, { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
  return dateFormatter.format(new Date(value)).replace(/\. /g, ".").replace(/\.$/, "");
}

export function CompactReservationCard({ reservation, onSelect }: {reservation: ReservationViewModel;onSelect: (reservation: ReservationViewModel) => void;}) {const locale = useLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const i18n = useTranslations();
  const provider = getProviderVisual(reservation.provider);
  const nights = Math.max(1, differenceInCalendarDays(new Date(reservation.endDate), new Date(reservation.startDate)));
  return (
    <button
      type="button"
      onClick={() => onSelect(reservation)}
      className="grid min-h-26 w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-xl bg-card px-3 py-2 text-left ring-1 ring-foreground/10 transition hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.995]"
      aria-label={i18n("auto.m0391", { value0: reservation.roomName, value1: getReservationDisplayName(reservation, i18n("auto.m0397")) })}>
      
      <div className="flex min-w-0 items-center gap-2">
        <ReservationStatusBadge status={reservation.displayStatus} />
        <strong className="truncate text-base leading-5">{reservation.roomName}</strong>
        {reservation.activeConflictCount > 0 && <Badge variant="destructive" className="h-5 gap-1 px-1.5 text-[10px]"><AlertTriangle />{i18n("auto.m0375")}</Badge>}
      </div>
      <ChevronRight className="row-span-4 mt-1 size-4 text-muted-foreground" aria-hidden="true" />
      <p className="truncate text-xs text-muted-foreground">{reservation.propertyName}</p>
      <p className="text-sm font-medium tabular-nums">{compactDate(reservation.startDate, localeTag)} → {compactDate(reservation.endDate, localeTag)} <span className="text-xs font-normal text-muted-foreground">· {i18n("units.nights", { count: nights })}</span></p>
      <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate">{i18n("auto.m0392")}{getReservationDisplayName(reservation, i18n("auto.m0397"))}</span>
        <Badge variant="outline" className={cn("h-5 shrink-0 px-1.5 text-[10px]", provider.className)}>{reservation.provider === "OTHER" ? getProviderLabel(reservation.provider, i18n) : provider.shortLabel}</Badge>
      </div>
    </button>);

}
