"use client";import { useTranslations } from "next-intl";

import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertTriangle, ArrowUpRight, CalendarDays, Clock3, List, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getProviderLabel, getProviderVisual } from "@/features/reservations/provider-visuals";
import { getReservationDisplayName } from "@/features/reservations/reservation-display";
import type { RoomOverviewCard } from "../domain/room-overview";
import { getMobileRoomStatusVisual, getMobileSyncLabel } from "../room-overview-mobile-visuals";
import { RoomStatusRoomSyncButton } from "./room-status-room-sync-button";

export function RoomDetailContent({ room, canSync }: {room: RoomOverviewCard;canSync: boolean;}) {const i18n = useTranslations();
  const reservation = room.currentReservation ?? room.nextReservation;
  const status = getMobileRoomStatusVisual(room, i18n);
  const StatusIcon = status.icon;
  const sync = getMobileSyncLabel(room, i18n);
  const reservationsHref = `/reservations?roomId=${room.id}`;
  const detailHref = reservation ? `${reservationsHref}&from=${format(reservation.startDate, "yyyy-MM-dd")}&to=${format(reservation.endDate, "yyyy-MM-dd")}` : reservationsHref;
  const nights = reservation ? Math.max(1, differenceInCalendarDays(reservation.endDate, reservation.startDate)) : 0;

  return <>
    <div className="grid grid-cols-2 gap-2 px-4">
      <div className={cn("rounded-lg border p-2.5", status.bodyClass)}><span className="block text-[10px] text-muted-foreground">{i18n("auto.m0227")}</span><Badge variant="outline" className={cn("mt-1 gap-1", status.badgeClass)}><StatusIcon aria-hidden="true" className="size-3" />{status.label}</Badge></div>
      <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("common.sync")}</span><span className={cn("mt-1 flex items-center gap-1 text-xs font-medium", sync.error && "text-destructive")}><Clock3 className="size-3" />{sync.label}</span></div>
      <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("reservation.checkIn")}</span><strong className="mt-1 block text-sm">{reservation ? format(reservation.startDate, "yyyy-MM-dd") : "-"}</strong></div>
      <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("reservation.checkOut")}</span><strong className="mt-1 block text-sm">{reservation ? format(reservation.endDate, "yyyy-MM-dd") : "-"}</strong></div>
      <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("auto.m0407")}</span><strong className="mt-1 block text-sm">{nights ? i18n("auto.m0408", { value0: nights }) : "-"}</strong></div>
      <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">{i18n("auto.m0469")}</span><strong className="mt-1 block text-sm">{room.reservationCount}{i18n("auto.m0013")}</strong></div>
    </div>

    <section className="space-y-2 px-4" aria-labelledby="room-detail-ota">
      <h3 id="room-detail-ota" className="text-xs font-semibold">{i18n("auto.m0470")}</h3>
      <div className="flex flex-wrap gap-1.5">{room.providers.length ? room.providers.map((provider) => {const visual = getProviderVisual(provider);return <Badge key={provider} variant="outline" className={visual.className}>{visual.label}</Badge>;}) : <span className="flex items-center gap-1 text-xs text-muted-foreground"><WifiOff className="size-3" />{i18n("auto.m0248")}</span>}</div>
    </section>

    {room.activeConflictCount > 0 && <div className="mx-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs font-medium text-destructive"><AlertTriangle className="size-4" />{i18n("reservation.overbooking")}{room.activeConflictCount}{i18n("auto.m0471")}</div>}

    <section className="min-h-0 space-y-2 px-4" aria-labelledby="room-detail-reservations">
      <h3 id="room-detail-reservations" className="text-xs font-semibold">{i18n("auto.m0250")}</h3>
      <div className="max-h-48 space-y-1.5 overflow-y-auto">
        {room.reservations.length ? room.reservations.map((item) => {const visual = getProviderVisual(item.provider);return <div key={item.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs"><Badge variant="outline" className={cn("shrink-0", visual.className)}>{item.provider === "OTHER" ? getProviderLabel(item.provider, i18n) : visual.shortLabel}</Badge><span className="min-w-0 flex-1 truncate">{getReservationDisplayName(item, i18n("auto.m0397"))}</span><span className="shrink-0 text-[10px] text-muted-foreground">{format(item.startDate, "M/d")}–{format(item.endDate, "M/d")}</span></div>;}) : <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">{i18n("auto.m0472")}</p>}
      </div>
    </section>

    <div className="sticky bottom-0 mt-auto grid grid-cols-3 gap-2 border-t bg-popover px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <Button nativeButton={false} render={<Link href={detailHref} />} variant="outline" size="sm"><ArrowUpRight />{i18n("common.details")}</Button>
      <Button nativeButton={false} render={<Link href={reservationsHref} />} variant="outline" size="sm"><List />{i18n("common.reservation")}</Button>
      <Button nativeButton={false} render={<Link href={`/room-status?propertyId=${room.propertyId}`} />} variant="outline" size="sm"><CalendarDays />{i18n("common.calendar")}</Button>
      {canSync && <RoomStatusRoomSyncButton roomIds={[room.id]} className="col-span-3 min-h-10" />}
    </div>
  </>;
}

export function RoomDetailSheet({ room, open, canSync, onOpenChange }: {room: RoomOverviewCard | null;open: boolean;canSync: boolean;onOpenChange: (open: boolean) => void;}) {const i18n = useTranslations();
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="h-[82dvh] max-h-[82dvh] gap-3 overflow-hidden p-0" aria-label={i18n("auto.m0473")}>
      {room && <>
        <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
          <SheetTitle className="text-lg font-bold">{room.name}</SheetTitle>
          <SheetDescription>{room.propertyName}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"><RoomDetailContent room={room} canSync={canSync} /></div>
      </>}
    </SheetContent>
  </Sheet>;
}
