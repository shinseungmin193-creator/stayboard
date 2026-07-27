"use client";

import { useMemo, useState } from "react";
import { BedDouble } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { RoomOverviewCard } from "../domain/room-overview";
import { filterMobileRooms, sortMobileRooms, summarizeMobileRooms, type CalendarRangeDays, type MobileRoomFilters, type MobileRoomSortDirection, type MobileRoomSortField } from "../domain/room-overview-mobile";
import { useRoomStatusFilters } from "../hooks/use-room-status-filters";
import { useRoomTimelineRange } from "../hooks/use-room-timeline-range";
import { useRoomStatusViewMode } from "../hooks/use-room-status-view-mode";
import { RoomDetailSheet } from "./room-detail-sheet";
import { RoomSelectionActionBar } from "./room-selection-action-bar";
import { RoomStatusCalendar } from "./room-status-calendar";
import { RoomStatusCardGrid } from "./room-status-card-grid";
import { RoomStatusList } from "./room-status-list";
import { RoomStatusMobileToolbar } from "./room-status-mobile-toolbar";
import { ReservationDetailSheet } from "./reservation-detail-sheet";

export function MobileRoomStatusWorkspace({
  rooms,
  properties,
  selectedDate,
  today,
  propertyId,
  queryView,
  calendarRange,
  hasCalendarRangeQuery,
  initialFilters,
  canSync,
}: {
  rooms: RoomOverviewCard[];
  properties: Array<{ id: string; name: string; isActive: boolean }>;
  selectedDate: string;
  today: string;
  propertyId?: string;
  queryView?: string;
  calendarRange: CalendarRangeDays;
  hasCalendarRangeQuery: boolean;
  initialFilters: MobileRoomFilters;
  canSync: boolean;
}) {
  const { viewMode, setViewMode } = useRoomStatusViewMode(queryView);
  const { rangeDays, setRange } = useRoomTimelineRange(calendarRange, hasCalendarRangeQuery);
  const { filters, updateQuery, updateStatus, applyFilters, resetFilters } = useRoomStatusFilters({ initialFilters, initialPropertyId: propertyId });
  const [sortField, setSortField] = useState<MobileRoomSortField>("room");
  const [sortDirection, setSortDirection] = useState<MobileRoomSortDirection>("asc");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [detailRoom, setDetailRoom] = useState<RoomOverviewCard | null>(null);
  const [detailReservation, setDetailReservation] = useState<{ room: RoomOverviewCard; reservation: RoomOverviewCard["reservations"][number] } | null>(null);
  const [todayScrollRequest, setTodayScrollRequest] = useState(0);

  const summary = useMemo(() => summarizeMobileRooms(rooms), [rooms]);
  const visibleRooms = useMemo(() => sortMobileRooms(filterMobileRooms(rooms, filters), sortField, sortDirection), [filters, rooms, sortDirection, sortField]);
  const selectedRooms = useMemo(() => rooms.filter((room) => selectedIds.has(room.id)), [rooms, selectedIds]);

  const activateRoom = (room: RoomOverviewCard) => {
    if (!selectionMode) {
      setDetailRoom(room);
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(room.id)) next.delete(room.id);
      else next.add(room.id);
      return next;
    });
  };

  const changeSelectionMode = (active: boolean) => {
    setSelectionMode(active);
    if (!active) setSelectedIds(new Set());
  };

  const changeSort = (field: MobileRoomSortField) => {
    if (field === sortField) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  return (
    <div className={selectionMode && selectedIds.size ? "space-y-3 pb-28 xl:hidden" : "space-y-3 xl:hidden"}>
      <h1 className="sr-only">객실 현황</h1>
      <RoomStatusMobileToolbar
        selectedDate={selectedDate}
        today={today}
        summary={summary}
        filters={filters}
        propertyId={propertyId}
        properties={properties}
        viewMode={viewMode}
        selectionMode={selectionMode}
        resultCount={visibleRooms.length}
        canSync={canSync}
        calendarRangeDays={rangeDays}
        onViewModeChange={setViewMode}
        onQueryChange={updateQuery}
        onStatusChange={updateStatus}
        onFiltersApply={applyFilters}
        onFiltersReset={resetFilters}
        onSelectionModeChange={changeSelectionMode}
        onCalendarTodayClick={() => setTodayScrollRequest((current) => current + 1)}
      />

      {visibleRooms.length === 0 ? <div className="flex min-h-56 items-center rounded-xl border bg-card"><EmptyState icon={BedDouble} title="조건에 맞는 객실이 없습니다" description="검색어나 필터 조건을 변경해 보세요." /></div> : <>
        {viewMode === "card" && <RoomStatusCardGrid rooms={visibleRooms} selectionMode={selectionMode} selectedIds={selectedIds} onActivate={activateRoom} />}
        {viewMode === "list" && <RoomStatusList rooms={visibleRooms} sortField={sortField} sortDirection={sortDirection} selectionMode={selectionMode} selectedIds={selectedIds} onSort={changeSort} onActivate={activateRoom} />}
        {viewMode === "calendar" && <RoomStatusCalendar rooms={visibleRooms} selectedDate={selectedDate} today={today} rangeDays={rangeDays} todayScrollRequest={todayScrollRequest} selectionMode={selectionMode} selectedIds={selectedIds} onRangeChange={setRange} onRoomActivate={activateRoom} onReservationActivate={(room, reservation) => { if (selectionMode) activateRoom(room); else setDetailReservation({ room, reservation }); }} />}
      </>}

      <RoomDetailSheet room={detailRoom} open={Boolean(detailRoom)} canSync={canSync} onOpenChange={(open) => { if (!open) setDetailRoom(null); }} />
      <ReservationDetailSheet room={detailReservation?.room ?? null} reservation={detailReservation?.reservation ?? null} open={Boolean(detailReservation)} canSync={canSync} onOpenChange={(open) => { if (!open) setDetailReservation(null); }} />
      <RoomSelectionActionBar rooms={selectedRooms} canSync={canSync} onShowDetail={() => setDetailRoom(selectedRooms[0] ?? null)} onClose={() => changeSelectionMode(false)} />
    </div>
  );
}
