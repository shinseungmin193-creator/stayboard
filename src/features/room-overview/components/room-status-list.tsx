"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Check, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoomOverviewCard } from "../domain/room-overview";
import type { MobileRoomSortDirection, MobileRoomSortField } from "../domain/room-overview-mobile";
import { formatMobileRoomDate, getMobileRoomStatusVisual } from "../room-overview-mobile-visuals";
import { RoomInspectionStatusBadge } from "./room-inspection-status-badge";

export function RoomStatusList({
  rooms,
  sortField,
  sortDirection,
  selectionMode,
  selectedIds,
  canReadRoomNotes,
  canCreateRoomNotes,
  onSort,
  onActivate,
  onInspectionActivate,
  onCreateRoomNote,
}: {
  rooms: RoomOverviewCard[];
  sortField: MobileRoomSortField;
  sortDirection: MobileRoomSortDirection;
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  canReadRoomNotes: boolean;
  canCreateRoomNotes: boolean;
  onSort: (field: MobileRoomSortField) => void;
  onActivate: (room: RoomOverviewCard) => void;
  onInspectionActivate: (room: RoomOverviewCard) => void;
  onCreateRoomNote: (room: RoomOverviewCard) => void;
}) {
  const locale = useLocale();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const i18n = useTranslations();
  const columns: Array<{ field: MobileRoomSortField; label: string; className: string }> = [
    { field: "status", label: i18n("common.status"), className: "justify-center" },
    { field: "checkIn", label: i18n("reservation.checkIn"), className: "justify-center" },
    { field: "checkOut", label: i18n("reservation.checkOut"), className: "justify-center" },
  ];
  const sortButton = (field: MobileRoomSortField, label: string, className?: string) => {
    const active = sortField === field;
    const Icon = sortDirection === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn("flex min-h-10 items-center gap-0.5 text-[10px] font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", className, active && "text-foreground")}
      >
        {label}{active && <Icon className="size-3" />}
      </button>
    );
  };

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={i18n("auto.m0517")}>
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_3.5rem] border-b bg-card/95 px-2 backdrop-blur">
        <div className="flex min-w-0 gap-2">{sortButton("room", i18n("common.room"))}{sortButton("property", i18n("common.property"))}</div>
        {columns.map((column) => {
          const active = sortField === column.field;
          const Icon = sortDirection === "asc" ? ArrowUp : ArrowDown;
          return (
            <button
              key={column.field}
              type="button"
              onClick={() => onSort(column.field)}
              className={cn("flex min-h-10 items-center gap-0.5 text-[10px] font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", column.className, active && "text-foreground")}
            >
              {column.label}{active && <Icon className="size-3" />}
            </button>
          );
        })}
      </div>
      <div className="divide-y">
        {rooms.map((room) => {
          const reservation = room.currentReservation ?? room.nextReservation;
          const status = getMobileRoomStatusVisual(room, i18n);
          const StatusIcon = status.icon;
          const selected = selectedIds.has(room.id);
          const showInspectionRow = !selectionMode && (canCreateRoomNotes || room.inspectionStatus !== "NONE");
          const canOpenInspection = canReadRoomNotes && room.inspectionStatus !== "NONE";

          return (
            <div
              key={room.id}
              className={cn("[content-visibility:auto] [contain-intrinsic-size:auto_76px]", selected && "bg-primary/5")}
              data-mobile-room-inspection-status={room.inspectionStatus}
            >
              <button
                type="button"
                onClick={() => onActivate(room)}
                aria-pressed={selectionMode ? selected : undefined}
                className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_3.5rem] items-center px-2 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {selectionMode && <span className={cn("grid size-4 shrink-0 place-items-center rounded border", selected && "border-primary bg-primary text-primary-foreground")}>{selected && <Check className="size-3" />}</span>}
                  <span className="min-w-0"><strong className="block truncate text-sm leading-4">{room.name}</strong><span className="block truncate text-[9px] text-muted-foreground">{room.propertyName}</span></span>
                </span>
                <Badge variant="outline" className={cn("mx-auto h-5 max-w-[4.25rem] gap-0.5 px-1 text-[8px]", status.badgeClass)}><StatusIcon aria-hidden="true" className="size-2.5 shrink-0" /><span className="truncate">{status.label}</span></Badge>
                <span className="text-center text-[10px] tabular-nums">{formatMobileRoomDate(reservation?.startDate, localeTag)}</span>
                <span className="text-center text-[10px] tabular-nums">{formatMobileRoomDate(reservation?.endDate, localeTag)}</span>
              </button>

              {showInspectionRow && (
                <div className="flex min-h-9 items-center gap-2 border-t border-dashed bg-muted/15 px-2 py-1">
                  <span className="shrink-0 text-[9px] font-semibold text-muted-foreground">{i18n("roomOverviewList.inspection")}</span>
                  {room.inspectionStatus !== "NONE" && (
                    <RoomInspectionStatusBadge
                      status={room.inspectionStatus}
                      pendingCount={room.pendingMemoCount}
                      onClick={canOpenInspection ? () => onInspectionActivate(room) : undefined}
                    />
                  )}
                  {canCreateRoomNotes && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="ml-auto h-7 gap-1 px-2 text-[10px]"
                      onClick={() => onCreateRoomNote(room)}
                    >
                      <Plus className="size-3" />{i18n("roomOverviewList.registerInspection")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
