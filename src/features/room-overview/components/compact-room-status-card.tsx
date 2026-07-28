"use client";import { useLocale, useTranslations } from "next-intl";

import { AlertTriangle, Check, Clock3, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getProviderVisual } from "@/features/reservations/provider-visuals";
import type { RoomOverviewCard } from "../domain/room-overview";
import { formatMobileRoomDate, getMobileRoomStatusVisual, getMobileSyncLabel } from "../room-overview-mobile-visuals";

export function CompactRoomStatusCard({
  room,
  selectionMode,
  selected,
  onActivate





}: {room: RoomOverviewCard;selectionMode: boolean;selected: boolean;onActivate: () => void;}) {const locale = useLocale();const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const i18n = useTranslations();
  const reservation = room.currentReservation ?? room.nextReservation;
  const status = getMobileRoomStatusVisual(room, i18n);
  const sync = getMobileSyncLabel(room, i18n);
  const visibleProviders = room.providers.slice(0, 2);

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-pressed={selectionMode ? selected : undefined}
      aria-label={`${room.propertyName} ${room.name} ${status.label}`}
      className={cn(
        "relative flex min-h-[9.25rem] min-w-0 flex-col rounded-xl border bg-card p-2.5 text-left outline-none transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_148px] hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
        room.activeConflictCount > 0 && "border-destructive/70",
        selected && "border-primary bg-primary/5 ring-2 ring-primary/30"
      )}>
      
      <div className="flex min-w-0 items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-black leading-5 tracking-tight">{room.name}</h3>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{room.propertyName}</p>
        </div>
        {selectionMode && <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>{selected && <Check className="size-3" />}</span>}
        {!selectionMode && <Badge variant="outline" className={cn("h-5 shrink-0 px-1.5 text-[9px]", status.className)}>{status.label}</Badge>}
      </div>

      <div className="mt-2 min-h-8 text-[10px] leading-4">
        {reservation ? <p className="truncate font-medium"><span>{formatMobileRoomDate(reservation.startDate, localeTag)}</span><span className="mx-1 text-muted-foreground">→</span><span>{formatMobileRoomDate(reservation.endDate, localeTag)}</span></p> : <p className="text-muted-foreground">{i18n("reservation.none")}</p>}
        {reservation && <p className="truncate text-muted-foreground">{room.currentReservation ? i18n("auto.m0460") : i18n("auto.m0330")} · {room.reservationCount}{i18n("auto.m0013")}</p>}
      </div>

      <div className="mt-1 flex min-h-5 min-w-0 items-center gap-1 overflow-hidden" aria-label={i18n("auto.m0461")}>
        {visibleProviders.map((provider) => {
          const visual = getProviderVisual(provider);
          return <Badge key={provider} variant="outline" className={cn("h-5 min-w-0 px-1 text-[9px]", visual.className)}><span className="truncate">{visual.shortLabel}</span></Badge>;
        })}
        {room.providers.length > visibleProviders.length && <span className="shrink-0 text-[9px] text-muted-foreground">+{room.providers.length - visibleProviders.length}</span>}
        {room.providers.length === 0 && <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><WifiOff className="size-3" />{i18n("auto.m0248")}</span>}
      </div>

      <div className="mt-auto flex min-w-0 items-center justify-between gap-1 border-t pt-1.5 text-[9px] text-muted-foreground">
        <span className={cn("flex min-w-0 items-center gap-1", sync.error && "font-medium text-destructive")}><Clock3 className="size-3 shrink-0" /><span className="truncate">{sync.label}</span></span>
        {room.activeConflictCount > 0 && <span className="flex shrink-0 items-center gap-0.5 font-semibold text-destructive"><AlertTriangle className="size-3" />{room.activeConflictCount}</span>}
      </div>
    </button>);

}
