"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import type { RoomOverviewCard, RoomOverviewReservation } from "../domain/room-overview";
import { buildCalendarDateRange, getCalendarRangeStart, groupRoomsForCalendar, TIMELINE_DATE_COLUMN_WIDTHS, TIMELINE_ROOM_COLUMN_WIDTH, type CalendarRangeDays } from "../domain/room-overview-mobile";
import { useCollapsedRoomGroups } from "../hooks/use-collapsed-room-groups";
import { useTimelineScroll } from "../hooks/use-timeline-scroll";
import { CalendarRangeSelector } from "./calendar-range-selector";
import { TimelineDateHeader } from "./timeline-date-header";
import { TimelineGroupHeader } from "./timeline-group-header";
import { TimelineRoomRow } from "./timeline-room-row";

const legend = [
  { label: "예약", className: "bg-amber-400" },
  { label: "체크인", className: "bg-blue-500" },
  { label: "체크아웃", className: "bg-violet-500" },
  { label: "공실", className: "bg-emerald-400" },
  { label: "청소중", className: "bg-slate-400" },
  { label: "오버부킹", className: "bg-red-500" },
];

export function RoomStatusCalendar({ rooms, selectedDate, today, rangeDays, todayScrollRequest, selectionMode, selectedIds, onRangeChange, onRoomActivate, onReservationActivate }: { rooms: RoomOverviewCard[]; selectedDate: string; today: string; rangeDays: CalendarRangeDays; todayScrollRequest: number; selectionMode: boolean; selectedIds: ReadonlySet<string>; onRangeChange: (range: CalendarRangeDays) => void; onRoomActivate: (room: RoomOverviewCard) => void; onReservationActivate: (room: RoomOverviewCard, reservation: RoomOverviewReservation) => void }) {
  const days = useMemo(() => buildCalendarDateRange(selectedDate, rangeDays), [rangeDays, selectedDate]);
  const rangeStart = getCalendarRangeStart(selectedDate, rangeDays);
  const columnWidth = TIMELINE_DATE_COLUMN_WIDTHS[rangeDays];
  const timelineWidth = rangeDays * columnWidth;
  const groups = useMemo(() => groupRoomsForCalendar(rooms, rangeStart, rangeDays), [rangeDays, rangeStart, rooms]);
  const { collapsedIds, toggleGroup } = useCollapsedRoomGroups();
  const anchorIndex = days.indexOf(selectedDate);
  const { containerRef } = useTimelineScroll({ anchorIndex: Math.max(0, anchorIndex), columnWidth, roomColumnWidth: TIMELINE_ROOM_COLUMN_WIDTH, scrollRequest: todayScrollRequest });
  const todayIndex = days.indexOf(today);

  return <section className="-mx-3 overflow-hidden border-y bg-card sm:mx-0 sm:rounded-xl sm:border" aria-label={`${rangeDays}일 객실 타임라인 캘린더`}>
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2"><div><strong className="block text-xs">객실 타임라인</strong><span className="text-[9px] text-muted-foreground">예약 막대를 눌러 상세 확인</span></div><CalendarRangeSelector value={rangeDays} onChange={onRangeChange} /></div>
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
        {todayIndex >= 0 && <div className="pointer-events-none absolute bottom-0 top-12 z-[15] border-l border-primary/60" style={{ left: TIMELINE_ROOM_COLUMN_WIDTH + todayIndex * columnWidth + columnWidth / 2 }}><span className="sr-only">오늘 위치</span></div>}
      </div>
    </div>
    <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 text-[9px] text-muted-foreground" aria-label="객실 타임라인 상태 범례">{legend.map((item) => <span key={item.label} className="flex items-center gap-1"><span className={`size-2 rounded-full ${item.className}`} />{item.label}</span>)}<span className="ml-auto flex items-center gap-1 text-destructive"><AlertTriangle className="size-3" />충돌 강조</span></footer>
  </section>;
}
