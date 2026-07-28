"use client";

import { Check } from "lucide-react";
import { getProviderVisual } from "@/features/reservations/provider-visuals";
import { formatRoomDisplayLabel, formatRoomNumber } from "@/features/rooms/room-display";
import { cn } from "@/lib/utils";
import type { RoomOverviewCard, RoomOverviewReservation } from "../domain/room-overview";
import { buildMobileRoomCalendarSegments, TIMELINE_RESERVATION_HEIGHT, TIMELINE_ROOM_COLUMN_WIDTH, TIMELINE_ROW_MIN_HEIGHT } from "../domain/room-overview-mobile";
import { MOBILE_ROOM_STATUS_VISUALS } from "../room-overview-mobile-visuals";
import { TimelineReservationBar } from "./timeline-reservation-bar";

export function TimelineRoomRow({ room, days, rangeStart, columnWidth, selectedDate, selectionMode, selected, onRoomActivate, onReservationActivate }: { room: RoomOverviewCard; days: string[]; rangeStart: string; columnWidth: number; selectedDate: string; selectionMode: boolean; selected: boolean; onRoomActivate: () => void; onReservationActivate: (reservation: RoomOverviewReservation) => void }) {
  const segments = buildMobileRoomCalendarSegments(room, rangeStart, days.length);
  const laneCount = segments[0]?.laneCount ?? 1;
  const rowHeight = Math.max(TIMELINE_ROW_MIN_HEIGHT, 6 + laneCount * (TIMELINE_RESERVATION_HEIGHT + 2));
  const propertyName = room.propertyName.trim();
  const roomNumber = formatRoomNumber(room.name.trim() || room.code);
  const roomLabel = formatRoomDisplayLabel({ propertyName, roomName: room.name, roomNumber: room.code });
  const providerLabel = room.providers.length
    ? room.providers.map((provider) => getProviderVisual(provider).label).join(" · ")
    : "OTA 없음";
  return <div className={cn("relative flex border-b [content-visibility:auto]", selected && "bg-primary/5")} style={{ height: rowHeight, containIntrinsicSize: `${rowHeight}px` }}>
    <button type="button" onClick={onRoomActivate} aria-pressed={selectionMode ? selected : undefined} className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r bg-card px-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" style={{ width: TIMELINE_ROOM_COLUMN_WIDTH }}>
      {selectionMode && <span className={cn("grid size-4 shrink-0 place-items-center rounded border", selected && "border-primary bg-primary text-primary-foreground")}>{selected && <Check className="size-3" />}</span>}
      <span className="min-w-0 flex-1"><strong className="flex min-w-0 items-baseline gap-1 text-[11px] leading-4" title={roomLabel}>{propertyName && <span className="min-w-0 truncate">{propertyName}</span>}<span className="shrink-0">{roomNumber}</span></strong><span className="block truncate text-[8px] leading-3 text-muted-foreground" title={providerLabel}>{providerLabel}</span></span>
    </button>
    <div className="relative" style={{ width: days.length * columnWidth, height: rowHeight }}>
      <button type="button" onClick={onRoomActivate} className="absolute inset-0 z-0 grid outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" style={{ gridTemplateColumns: `repeat(${days.length}, ${columnWidth}px)` }} aria-label={`${room.name} 객실 상세 열기`}>
        {days.map((dateKey) => <span key={dateKey} className={cn("h-full border-r", dateKey === selectedDate && "bg-primary/5")} />)}
      </button>
      {segments.length === 0 && <span className={cn("pointer-events-none absolute left-1 right-1 top-1/2 flex h-5 -translate-y-1/2 items-center rounded-full border px-2 text-[9px] font-medium", MOBILE_ROOM_STATUS_VISUALS.VACANT.className)}>공실</span>}
      {segments.map((segment) => <TimelineReservationBar key={segment.id} segment={segment} columnWidth={columnWidth} onActivate={() => onReservationActivate(segment.reservation)} />)}
    </div>
  </div>;
}
