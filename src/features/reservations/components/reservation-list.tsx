"use client";import { useTranslations, useLocale } from "next-intl";

import { differenceInCalendarDays } from "date-fns";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReservationViewModel } from "../reservation-view-model";
import { getReservationDisplayName } from "../reservation-display";
import { getProviderLabel, getProviderVisual } from "../provider-visuals";
import { CompactReservationCard } from "./compact-reservation-card";
import { ReservationStatusBadge } from "./reservation-status-badge";
import type { ReservationDisplayStatus } from "../reservation-display-status";



export function ReservationList({ reservations, onSelect, contextualStatus }: {reservations: ReservationViewModel[];onSelect: (reservation: ReservationViewModel) => void;contextualStatus?: {status: ReservationDisplayStatus;label: string;};}) {const locale = useLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const dateFormatter = new Intl.DateTimeFormat(localeTag, { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });const i18n = useTranslations();
  return (
    <>
      <div className="grid gap-2 md:hidden">{reservations.map((reservation) => <CompactReservationCard key={reservation.id} reservation={reservation} onSelect={onSelect} contextualStatus={contextualStatus} />)}</div>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(11rem,1.5fr)_minmax(11rem,1.5fr)_minmax(8rem,1fr)_7rem_2rem] gap-3 border-b bg-muted/45 px-4 py-2 text-xs font-semibold text-muted-foreground">
          <span>{i18n("auto.m0443")}</span><span>{i18n("common.property")}</span><span>{i18n("auto.m0432")}</span><span>{i18n("auto.m0409")}</span><span>{i18n("technical.ota")}</span><span className="sr-only">{i18n("common.details")}</span>
        </div>
        <div className="divide-y">
          {reservations.map((reservation) => {
            const provider = getProviderVisual(reservation.provider);
            const nights = Math.max(1, differenceInCalendarDays(new Date(reservation.endDate), new Date(reservation.startDate)));
            return (
              <button key={reservation.id} type="button" onClick={() => onSelect(reservation)} className="grid min-h-14 w-full grid-cols-[minmax(8rem,1fr)_minmax(11rem,1.5fr)_minmax(11rem,1.5fr)_minmax(8rem,1fr)_7rem_2rem] items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="flex min-w-0 items-center gap-2"><ReservationStatusBadge status={contextualStatus?.status ?? reservation.displayStatus} label={contextualStatus?.label} /><strong className="truncate">{reservation.roomName}</strong>{reservation.activeConflictCount > 0 && <AlertTriangle className="size-4 shrink-0 text-destructive" />}</span>
                <span className="truncate text-muted-foreground">{reservation.propertyName}</span>
                <span className="tabular-nums">{dateFormatter.format(new Date(reservation.startDate))} → {dateFormatter.format(new Date(reservation.endDate))} <span className="text-xs text-muted-foreground">· {i18n("units.nights", { count: nights })}</span></span>
                <span className="truncate">{getReservationDisplayName(reservation, i18n("auto.m0397"))}</span>
                <Badge variant="outline" className={cn("h-5", provider.className)}>{reservation.provider === "OTHER" ? getProviderLabel(reservation.provider, i18n) : provider.shortLabel}</Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>);

          })}
        </div>
      </div>
    </>);

}
