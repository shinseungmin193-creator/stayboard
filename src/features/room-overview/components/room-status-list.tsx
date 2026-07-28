"use client";import { useLocale, useTranslations } from "next-intl";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RoomOverviewCard } from "../domain/room-overview";
import type { MobileRoomSortDirection, MobileRoomSortField } from "../domain/room-overview-mobile";
import { formatMobileRoomDate, getMobileRoomStatusVisual } from "../room-overview-mobile-visuals";







export function RoomStatusList({
  rooms,
  sortField,
  sortDirection,
  selectionMode,
  selectedIds,
  onSort,
  onActivate








}: {rooms: RoomOverviewCard[];sortField: MobileRoomSortField;sortDirection: MobileRoomSortDirection;selectionMode: boolean;selectedIds: ReadonlySet<string>;onSort: (field: MobileRoomSortField) => void;onActivate: (room: RoomOverviewCard) => void;}) {const locale = useLocale();const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const i18n = useTranslations();const columns: Array<{field: MobileRoomSortField;label: string;className: string;}> = [{ field: "status", label: i18n("common.status"), className: "justify-center" }, { field: "checkIn", label: i18n("reservation.checkIn"), className: "justify-center" }, { field: "checkOut", label: i18n("reservation.checkOut"), className: "justify-center" }];
  const sortButton = (field: MobileRoomSortField, label: string, className?: string) => {
    const active = sortField === field;
    const Icon = sortDirection === "asc" ? ArrowUp : ArrowDown;
    return <button type="button" onClick={() => onSort(field)} className={cn("flex min-h-10 items-center gap-0.5 text-[10px] font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", className, active && "text-foreground")}>{label}{active && <Icon className="size-3" />}</button>;
  };

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={i18n("auto.m0517")}>
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_3.5rem] border-b bg-card/95 px-2 backdrop-blur">
        <div className="flex min-w-0 gap-2">{sortButton("room", i18n("common.room"))}{sortButton("property", i18n("common.property"))}</div>
        {columns.map((column) => {
          const active = sortField === column.field;
          const Icon = sortDirection === "asc" ? ArrowUp : ArrowDown;
          return <button key={column.field} type="button" onClick={() => onSort(column.field)} className={cn("flex min-h-10 items-center gap-0.5 text-[10px] font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", column.className, active && "text-foreground")}>{column.label}{active && <Icon className="size-3" />}</button>;
        })}
      </div>
      <div className="divide-y">
        {rooms.map((room) => {
          const reservation = room.currentReservation ?? room.nextReservation;
          const status = getMobileRoomStatusVisual(room, i18n);
          const selected = selectedIds.has(room.id);
          return <button key={room.id} type="button" onClick={() => onActivate(room)} aria-pressed={selectionMode ? selected : undefined} className={cn("grid min-h-14 w-full grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_3.5rem] items-center px-2 text-left outline-none [content-visibility:auto] [contain-intrinsic-size:auto_56px] hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", selected && "bg-primary/5")}>
            <span className="flex min-w-0 items-center gap-2">
              {selectionMode && <span className={cn("grid size-4 shrink-0 place-items-center rounded border", selected && "border-primary bg-primary text-primary-foreground")}>{selected && <Check className="size-3" />}</span>}
              <span className="min-w-0"><strong className="block truncate text-sm leading-4">{room.name}</strong><span className="block truncate text-[9px] text-muted-foreground">{room.propertyName}</span></span>
            </span>
            <Badge variant="outline" className={cn("mx-auto h-5 max-w-[4.25rem] px-1 text-[8px]", status.className)}><span className="truncate">{status.label}</span></Badge>
            <span className="text-center text-[10px] tabular-nums">{formatMobileRoomDate(reservation?.startDate, localeTag)}</span>
            <span className="text-center text-[10px] tabular-nums">{formatMobileRoomDate(reservation?.endDate, localeTag)}</span>
          </button>;
        })}
      </div>
    </section>);

}
