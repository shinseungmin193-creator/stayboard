"use client";

import { differenceInCalendarDays } from "date-fns";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReservationViewModel } from "../reservation-view-model";
import { getReservationDisplayName } from "../reservation-display";
import { getProviderVisual } from "../provider-visuals";
import { CompactReservationCard } from "./compact-reservation-card";
import { ReservationStatusBadge } from "./reservation-status-badge";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

export function ReservationList({ reservations, onSelect }: { reservations: ReservationViewModel[]; onSelect: (reservation: ReservationViewModel) => void }) {
  return (
    <>
      <div className="grid gap-2 md:hidden">{reservations.map((reservation) => <CompactReservationCard key={reservation.id} reservation={reservation} onSelect={onSelect} />)}</div>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(11rem,1.5fr)_minmax(11rem,1.5fr)_minmax(8rem,1fr)_7rem_2rem] gap-3 border-b bg-muted/45 px-4 py-2 text-xs font-semibold text-muted-foreground">
          <span>상태 · 객실</span><span>숙소</span><span>숙박 기간</span><span>예약자</span><span>OTA</span><span className="sr-only">상세</span>
        </div>
        <div className="divide-y">
          {reservations.map((reservation) => {
            const provider = getProviderVisual(reservation.provider);
            const nights = Math.max(1, differenceInCalendarDays(new Date(reservation.endDate), new Date(reservation.startDate)));
            return (
              <button key={reservation.id} type="button" onClick={() => onSelect(reservation)} className="grid min-h-14 w-full grid-cols-[minmax(8rem,1fr)_minmax(11rem,1.5fr)_minmax(11rem,1.5fr)_minmax(8rem,1fr)_7rem_2rem] items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="flex min-w-0 items-center gap-2"><ReservationStatusBadge status={reservation.displayStatus} /><strong className="truncate">{reservation.roomName}</strong>{reservation.activeConflictCount > 0 && <AlertTriangle className="size-4 shrink-0 text-destructive" />}</span>
                <span className="truncate text-muted-foreground">{reservation.propertyName}</span>
                <span className="tabular-nums">{dateFormatter.format(new Date(reservation.startDate))} → {dateFormatter.format(new Date(reservation.endDate))} <span className="text-xs text-muted-foreground">· {nights}박</span></span>
                <span className="truncate">{getReservationDisplayName(reservation)}</span>
                <Badge variant="outline" className={cn("h-5", provider.className)}>{provider.shortLabel}</Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
