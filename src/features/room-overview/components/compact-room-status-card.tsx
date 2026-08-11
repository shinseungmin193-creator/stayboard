"use client";

import { useLocale, useTranslations } from "next-intl";
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
  onActivate,
}: {
  room: RoomOverviewCard;
  selectionMode: boolean;
  selected: boolean;
  onActivate: () => void;
}) {
  const locale = useLocale();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const i18n = useTranslations();
  const reservation = room.currentReservation ?? room.nextReservation;
  const status = getMobileRoomStatusVisual(room, i18n);
  const StatusIcon = status.icon;
  const sync = getMobileSyncLabel(room, i18n);
  const visibleProviders = room.providers.slice(0, 2);

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-pressed={selectionMode ? selected : undefined}
      aria-label={`${room.propertyName} ${room.name} ${status.label}`}
      className={cn(
        "relative flex min-h-[9.25rem] min-w-0 flex-col overflow-hidden rounded-xl border p-0 text-left shadow-sm outline-none transition-[border-color,box-shadow,transform] [content-visibility:auto] [contain-intrinsic-size:auto_148px] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none",
        status.bodyClass,
        room.activeConflictCount > 0 && "border-destructive/70",
        selected && "border-primary bg-primary/5 ring-2 ring-primary/30",
      )}
      data-room-status-theme={status.status}
    >
      <div className={cn("flex min-w-0 items-start gap-1.5 px-2.5 py-2", status.headerClass)}>
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <StatusIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 stroke-[2.25]" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-black leading-5 tracking-tight">{room.name}</h3>
            <p className="truncate text-[9px] opacity-80">{room.propertyName}</p>
          </div>
        </div>
        {selectionMode && (
          <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground")}>
            {selected && <Check className="size-3" />}
          </span>
        )}
        {!selectionMode && (
          <Badge variant="outline" className={cn("h-5 shrink-0 px-1.5 text-[9px]", status.badgeClass)}>
            {status.label}
          </Badge>
        )}
      </div>

      <div className="min-h-8 px-2.5 pt-2 text-[10px] leading-4">
        {reservation ? (
          <p className="truncate font-medium">
            <span>{formatMobileRoomDate(reservation.startDate, localeTag)}</span>
            <span className="mx-1 text-muted-foreground">→</span>
            <span>{formatMobileRoomDate(reservation.endDate, localeTag)}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">{i18n("reservation.none")}</p>
        )}
        {reservation && (
          <p className="truncate text-muted-foreground">
            {room.currentReservation ? i18n("auto.m0460") : i18n("auto.m0330")} · {room.reservationCount}{i18n("auto.m0013")}
          </p>
        )}
      </div>

      <div className="mt-1 flex min-h-5 min-w-0 items-center gap-1 overflow-hidden px-2.5" aria-label={i18n("auto.m0461")}>
        {visibleProviders.map((provider) => {
          const visual = getProviderVisual(provider);
          return (
            <Badge key={provider} variant="outline" className={cn("h-5 min-w-0 px-1 text-[9px]", visual.className)}>
              <span className="truncate">{visual.shortLabel}</span>
            </Badge>
          );
        })}
        {room.providers.length > visibleProviders.length && (
          <span className="shrink-0 text-[9px] text-muted-foreground">+{room.providers.length - visibleProviders.length}</span>
        )}
        {room.providers.length === 0 && (
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <WifiOff className="size-3" />{i18n("auto.m0248")}
          </span>
        )}
      </div>

      <div className="mx-2.5 mt-auto flex min-w-0 items-center justify-between gap-1 border-t border-current/10 py-1.5 text-[9px] text-muted-foreground">
        <span className={cn("flex min-w-0 items-center gap-1", sync.error && "font-medium text-destructive")}>
          <Clock3 className="size-3 shrink-0" /><span className="truncate">{sync.label}</span>
        </span>
        {room.activeConflictCount > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 font-semibold text-destructive">
            <AlertTriangle className="size-3" />{room.activeConflictCount}
          </span>
        )}
      </div>
    </button>
  );
}
