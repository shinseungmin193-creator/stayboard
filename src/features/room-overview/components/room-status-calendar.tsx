"use client";import { useTranslations } from "next-intl";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { RoomOverviewCard, RoomOverviewReservation } from "../domain/room-overview";
import { buildCalendarDateRange, getCalendarRangeStart, groupRoomsForCalendar, TIMELINE_DATE_COLUMN_WIDTHS, TIMELINE_ROOM_COLUMN_WIDTH, type CalendarRangeDays } from "../domain/room-overview-mobile";
import { useCollapsedRoomGroups } from "../hooks/use-collapsed-room-groups";
import { useTimelineScroll } from "../hooks/use-timeline-scroll";
import { MOBILE_TIMELINE_TODAY_VISUAL } from "../room-overview-mobile-visuals";
import { CalendarRangeSelector } from "./calendar-range-selector";
import { TimelineDateHeader } from "./timeline-date-header";
import { TimelineGroupHeader } from "./timeline-group-header";
import { TimelineRoomRow } from "./timeline-room-row";

export function RoomStatusCalendar({ rooms, selectedDate, today, rangeDays, todayScrollRequest, selectionMode, selectedIds, onRangeChange, onRoomActivate, onReservationActivate }: {rooms: RoomOverviewCard[];selectedDate: string;today: string;rangeDays: CalendarRangeDays;todayScrollRequest: number;selectionMode: boolean;selectedIds: ReadonlySet<string>;onRangeChange: (range: CalendarRangeDays) => void;onRoomActivate: (room: RoomOverviewCard) => void;onReservationActivate: (room: RoomOverviewCard, reservation: RoomOverviewReservation) => void;}) {const i18n = useTranslations();
  const days = useMemo(() => buildCalendarDateRange(selectedDate, rangeDays), [rangeDays, selectedDate]);
  const rangeStart = getCalendarRangeStart(selectedDate, rangeDays);
  const columnWidth = TIMELINE_DATE_COLUMN_WIDTHS[rangeDays];
  const timelineWidth = rangeDays * columnWidth;
  const groups = useMemo(() => groupRoomsForCalendar(rooms, rangeStart, rangeDays), [rangeDays, rangeStart, rooms]);
  const { collapsedIds, toggleGroup } = useCollapsedRoomGroups();
  const anchorIndex = days.indexOf(selectedDate);
  const { containerRef } = useTimelineScroll({ anchorIndex: Math.max(0, anchorIndex), columnWidth, roomColumnWidth: TIMELINE_ROOM_COLUMN_WIDTH, scrollRequest: todayScrollRequest });
  const todayIndex = days.indexOf(today);

  return <section className="-mx-3 overflow-hidden border-y bg-card sm:mx-0 sm:rounded-xl sm:border" aria-label={i18n("auto.m0506", { value0: rangeDays })}>
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2"><div><strong className="block text-xs">{i18n("auto.m0507")}</strong><span className="text-[9px] text-muted-foreground">{i18n("auto.m0508")}</span></div><CalendarRangeSelector value={rangeDays} onChange={onRangeChange} /></div>
    <div ref={containerRef} className="h-[max(19rem,calc(100dvh-20rem))] max-h-[38rem] overflow-auto overscroll-contain [scrollbar-gutter:stable]" style={{ touchAction: "pan-x pan-y" }}>
      <div className="relative" style={{ width: TIMELINE_ROOM_COLUMN_WIDTH + timelineWidth }}>
        <TimelineDateHeader days={days} today={today} columnWidth={columnWidth} roomCount={rooms.length} />
        {groups.map((group) => {
          const collapsed = collapsedIds.has(group.id);
          return <div key={group.id}>
            <TimelineGroupHeader label={group.label} roomCount={group.roomCount} reservationCount={group.reservationCount} conflictCount={group.conflictCount} collapsed={collapsed} timelineWidth={timelineWidth} onToggle={() => toggleGroup(group.id)} />
            {!collapsed && group.rooms.map((room) => <TimelineRoomRow key={room.id} room={room} days={days} rangeStart={rangeStart} columnWidth={columnWidth} selectedDate={selectedDate} selectionMode={selectionMode} selected={selectedIds.has(room.id)} onRoomActivate={() => onRoomActivate(room)} onReservationActivate={(reservation) => onReservationActivate(room, reservation)} />)}
          </div>;
        })}
        {todayIndex >= 0 && <div className={cn("pointer-events-none absolute bottom-0 top-11 z-[15] w-px", MOBILE_TIMELINE_TODAY_VISUAL.lineClassName)} style={{ left: TIMELINE_ROOM_COLUMN_WIDTH + todayIndex * columnWidth + columnWidth / 2 }}><span className="sr-only">{i18n("auto.m0509")}</span></div>}
      </div>
    </div>
  </section>;
}
