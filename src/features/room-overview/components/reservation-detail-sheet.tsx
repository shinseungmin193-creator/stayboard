"use client";

import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertTriangle, ArrowUpRight, CalendarDays, Clock3, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getProviderVisual } from "@/features/reservations/provider-visuals";
import { getReservationDisplayName } from "@/features/reservations/reservation-display";
import { cn } from "@/lib/utils";
import type { RoomOverviewCard, RoomOverviewReservation } from "../domain/room-overview";
import { RoomStatusRoomSyncButton } from "./room-status-room-sync-button";

const syncLabels = { SUCCESS: "정상", RUNNING: "동기화 중", FAILED: "오류", TIMEOUT: "시간 초과" } as const;

export function ReservationDetailSheet({ room, reservation, canSync, open, onOpenChange }: { room: RoomOverviewCard | null; reservation: RoomOverviewReservation | null; canSync: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!room || !reservation) return null;
  const provider = getProviderVisual(reservation.provider);
  const nights = Math.max(1, differenceInCalendarDays(reservation.endDate, reservation.startDate));
  const sync = room.syncStates.find((item) => item.provider === reservation.provider);
  const dateFrom = format(reservation.startDate, "yyyy-MM-dd");
  const dateTo = format(reservation.endDate, "yyyy-MM-dd");
  const reservationHref = `/reservations?roomId=${room.id}&from=${dateFrom}&to=${dateTo}&provider=${reservation.provider}`;
  const calendarHref = `/room-overview?view=calendar&propertyId=${room.propertyId}&date=${dateFrom}`;

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="h-[84dvh] max-h-[84dvh] gap-0 overflow-hidden p-0" aria-label="예약 상세">
      <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
        <div className="flex items-center gap-2"><Badge variant="outline" className={provider.className}>{provider.label}</Badge>{room.activeConflictCount > 0 && <Badge variant="destructive"><AlertTriangle />오버부킹</Badge>}</div>
        <SheetTitle className="text-lg font-bold">{room.name}</SheetTitle>
        <SheetDescription>{room.propertyName} · 예약 상세</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">체크인</span><strong className="mt-1 block text-sm">{dateFrom}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">체크아웃</span><strong className="mt-1 block text-sm">{dateTo}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">숙박</span><strong className="mt-1 block text-sm">{nights}박</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">상태</span><strong className="mt-1 block text-sm">{reservation.status}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">예약자</span><strong className="mt-1 block truncate text-sm">{getReservationDisplayName(reservation)}</strong></div>
          <div className="rounded-lg border bg-muted/25 p-2.5"><span className="block text-[10px] text-muted-foreground">동기화</span><strong className={cn("mt-1 flex items-center gap-1 text-sm", sync && (sync.status === "FAILED" || sync.status === "TIMEOUT") && "text-destructive")}><Clock3 className="size-3.5" />{sync ? syncLabels[sync.status] : "기록 없음"}</strong></div>
        </div>

        <section className="space-y-1.5" aria-labelledby="reservation-provider-id"><h3 id="reservation-provider-id" className="text-xs font-semibold">OTA 예약 ID</h3><p className="break-all rounded-lg border bg-muted/25 p-2.5 font-mono text-[11px] text-muted-foreground">{reservation.providerReservationId?.trim() || "정보 없음"}</p></section>

        {room.activeConflictCount > 0 && <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs font-medium text-destructive"><AlertTriangle className="size-4" />같은 객실에 겹치는 예약이 있습니다.</div>}

        <section className="space-y-2" aria-labelledby="same-room-reservations">
          <h3 id="same-room-reservations" className="text-xs font-semibold">같은 객실의 OTA 예약</h3>
          <div className="space-y-1.5">{room.reservations.map((item) => { const visual = getProviderVisual(item.provider); return <div key={item.id} className={cn("flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs", item.id === reservation.id && "border-primary bg-primary/5")}><Badge variant="outline" className={cn("shrink-0", visual.className)}>{visual.shortLabel}</Badge><span className="min-w-0 flex-1 truncate">{getReservationDisplayName(item)}</span><span className="shrink-0 text-[10px] text-muted-foreground">{format(item.startDate, "M/d")}–{format(item.endDate, "M/d")}</span></div>; })}</div>
        </section>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t bg-popover px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button nativeButton={false} render={<Link href={reservationHref} />} variant="outline" size="sm"><ArrowUpRight />상세</Button>
        <Button nativeButton={false} render={<Link href={`/reservations?roomId=${room.id}`} />} variant="outline" size="sm"><List />예약 목록</Button>
        <Button nativeButton={false} render={<Link href={calendarHref} />} variant="outline" size="sm"><CalendarDays />캘린더</Button>
        {canSync && <RoomStatusRoomSyncButton roomIds={[room.id]} className="col-span-3 min-h-10" />}
      </div>
    </SheetContent>
  </Sheet>;
}
