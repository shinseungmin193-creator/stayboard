"use client";import { useTranslations } from "next-intl";

import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertTriangle, ArrowUpRight, CalendarDays, Clock3, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getProviderLabel, getProviderVisual } from "@/features/reservations/provider-visuals";
import { getReservationDisplayName } from "@/features/reservations/reservation-display";
import { getReservationSourceStatusLabel } from "@/features/reservations/reservation-status-meta";
import { cn } from "@/lib/utils";
import type { RoomOverviewCard, RoomOverviewReservation } from "../domain/room-overview";
import { RoomStatusRoomSyncButton } from "./room-status-room-sync-button";



export function ReservationDetailSheet({ room, reservation, canSync, open, onOpenChange }: {room: RoomOverviewCard | null;reservation: RoomOverviewReservation | null;canSync: boolean;open: boolean;onOpenChange: (open: boolean) => void;}) {const i18n = useTranslations();const syncLabels = { SUCCESS: i18n("sync.statuses.SUCCESS"), RUNNING: i18n("sync.statuses.RUNNING"), FAILED: i18n("sync.statuses.FAILED"), TIMEOUT: i18n("sync.statuses.TIMEOUT") } as const;
  if (!room || !reservation) return null;
  const provider = getProviderVisual(reservation.provider);
  const nights = Math.max(1, differenceInCalendarDays(reservation.endDate, reservation.startDate));
  const sync = room.syncStates.find((item) => item.provider === reservation.provider);
  const dateFrom = format(reservation.startDate, "yyyy-MM-dd");
  const dateTo = format(reservation.endDate, "yyyy-MM-dd");
  const reservationHref = `/reservations?roomId=${room.id}&from=${dateFrom}&to=${dateTo}&provider=${reservation.provider}`;
  const calendarHref = `/room-overview?view=calendar&propertyId=${room.propertyId}&date=${dateFrom}`;

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="h-[84dvh] max-h-[84dvh] gap-0 overflow-hidden p-0" aria-label={i18n("auto.m0418")}>
      <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
        <div className="flex items-center gap-2"><Badge variant="outline" className={provider.className}>{getProviderLabel(reservation.provider, i18n)}</Badge>{room.activeConflictCount > 0 && <Badge variant="destructive"><AlertTriangle />{i18n("reservation.overbooking")}</Badge>}</div>
        <SheetTitle className="text-lg font-bold">{room.name}</SheetTitle>
        <SheetDescription>{room.propertyName}{i18n("auto.m0419")}</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("reservation.checkIn")}</span><strong className="mt-1 block text-sm">{dateFrom}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("reservation.checkOut")}</span><strong className="mt-1 block text-sm">{dateTo}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("auto.m0407")}</span><strong className="mt-1 block text-sm">{i18n("units.nights", { count: nights })}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("common.status")}</span><strong className="mt-1 block text-sm">{getReservationSourceStatusLabel(reservation.status, i18n)}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("auto.m0409")}</span><strong className="mt-1 block truncate text-sm">{getReservationDisplayName(reservation, i18n("auto.m0397"))}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("common.sync")}</span><strong className={cn("mt-1 flex items-center gap-1 text-sm", sync && (sync.status === "FAILED" || sync.status === "TIMEOUT") && "text-destructive")}><Clock3 className="size-3.5" />{sync ? syncLabels[sync.status] : i18n("auto.m0465")}</strong></div>
        </div>

        <section className="space-y-1.5" aria-labelledby="reservation-provider-id"><h3 id="reservation-provider-id" className="text-xs font-semibold">{i18n("auto.m0466")}</h3><p className="break-all rounded-lg border bg-muted/25 p-2.5 font-mono text-[11px] text-muted-foreground">{reservation.providerReservationId?.trim() || i18n("auto.m0400")}</p></section>

        {room.activeConflictCount > 0 && <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs font-medium text-destructive"><AlertTriangle className="size-4" />{i18n("auto.m0467")}</div>}

        <section className="space-y-2" aria-labelledby="same-room-reservations">
          <h3 id="same-room-reservations" className="text-xs font-semibold">{i18n("auto.m0468")}</h3>
          <div className="space-y-1.5">{room.reservations.map((item) => {const visual = getProviderVisual(item.provider);return <div key={item.id} className={cn("flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs", item.id === reservation.id && "border-primary bg-primary/5")}><Badge variant="outline" className={cn("shrink-0", visual.className)}>{item.provider === "OTHER" ? getProviderLabel(item.provider, i18n) : visual.shortLabel}</Badge><span className="min-w-0 flex-1 truncate">{getReservationDisplayName(item, i18n("auto.m0397"))}</span><span className="shrink-0 text-[10px] text-muted-foreground">{format(item.startDate, "M/d")}–{format(item.endDate, "M/d")}</span></div>;})}</div>
        </section>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t bg-popover px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button nativeButton={false} render={<Link href={reservationHref} />} variant="outline" size="sm"><ArrowUpRight />{i18n("common.details")}</Button>
        <Button nativeButton={false} render={<Link href={`/reservations?roomId=${room.id}`} />} variant="outline" size="sm"><List />{i18n("auto.m0250")}</Button>
        <Button nativeButton={false} render={<Link href={calendarHref} />} variant="outline" size="sm"><CalendarDays />{i18n("common.calendar")}</Button>
        {canSync && <RoomStatusRoomSyncButton roomIds={[room.id]} className="col-span-3 min-h-10" />}
      </div>
    </SheetContent>
  </Sheet>;
}
