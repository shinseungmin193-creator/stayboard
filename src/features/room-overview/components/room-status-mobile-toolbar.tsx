"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Grid2X2, List, Search, SquareCheckBig } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoomOverviewSync } from "./room-overview-sync";
import { RoomStatusFilterSheet } from "./room-status-filter-sheet";
import { moveRoomOverviewDate, roomOverviewDateInstant, type CalendarRangeDays, type MobileRoomFilters, type MobileRoomSummary, type RoomStatusViewMode } from "../domain/room-overview-mobile";

const summaryItems: Array<{ key: MobileRoomFilters["status"]; label: string; count: keyof MobileRoomSummary }> = [
  { key: "ALL", label: "전체", count: "total" },
  { key: "RESERVED", label: "예약", count: "reserved" },
  { key: "VACANT", label: "공실", count: "vacant" },
  { key: "CHECK_IN_TODAY", label: "체크인", count: "checkIn" },
  { key: "CHECK_OUT_TODAY", label: "체크아웃", count: "checkOut" },
  { key: "CLEANING", label: "청소중", count: "cleaning" },
  { key: "CONFLICT", label: "오버부킹", count: "conflict" },
];

const viewItems: Array<{ value: RoomStatusViewMode; label: string; icon: typeof Grid2X2 }> = [
  { value: "card", label: "카드", icon: Grid2X2 },
  { value: "list", label: "목록", icon: List },
  { value: "calendar", label: "캘린더", icon: CalendarDays },
];

export function RoomStatusMobileToolbar({
  selectedDate,
  today,
  summary,
  filters,
  propertyId,
  properties,
  viewMode,
  selectionMode,
  resultCount,
  canSync,
  calendarRangeDays,
  onViewModeChange,
  onQueryChange,
  onStatusChange,
  onFiltersApply,
  onFiltersReset,
  onSelectionModeChange,
  onCalendarTodayClick,
}: {
  selectedDate: string;
  today: string;
  summary: MobileRoomSummary;
  filters: MobileRoomFilters;
  propertyId?: string;
  properties: Array<{ id: string; name: string; isActive: boolean }>;
  viewMode: RoomStatusViewMode;
  selectionMode: boolean;
  resultCount: number;
  canSync: boolean;
  calendarRangeDays: CalendarRangeDays;
  onViewModeChange: (view: RoomStatusViewMode) => void;
  onQueryChange: (query: string) => void;
  onStatusChange: (status: MobileRoomFilters["status"]) => void;
  onFiltersApply: (filters: MobileRoomFilters, propertyId?: string) => void;
  onFiltersReset: () => void;
  onSelectionModeChange: (active: boolean) => void;
  onCalendarTodayClick: () => void;
}) {
  const router = useRouter();
  const selected = roomOverviewDateInstant(selectedDate);
  const isToday = selectedDate === today;
  const calendarMode = viewMode === "calendar";
  const movementDays = calendarMode ? calendarRangeDays : 1;

  const navigateDate = (date?: string) => {
    const params = new URLSearchParams(window.location.search);
    if (!date || date === today) params.delete("date");
    else params.set("date", date);
    router.push(params.size ? `/room-overview?${params.toString()}` : "/room-overview");
  };

  const goToday = () => {
    if (calendarMode && isToday) onCalendarTodayClick();
    navigateDate(today);
  };
  const viewControl = <div className="grid grid-cols-3 rounded-lg bg-muted p-1" role="group" aria-label="보기 방식">
    {viewItems.map((item) => <Button key={item.value} type="button" variant={viewMode === item.value ? "secondary" : "ghost"} size="xs" className="min-h-9 px-2" onClick={() => onViewModeChange(item.value)} aria-pressed={viewMode === item.value}><item.icon />{item.label}</Button>)}
  </div>;

  return (
    <div className="space-y-3">
      <section aria-label="조회 날짜 이동" className="flex items-center gap-1.5 rounded-xl border bg-card p-2">
        <Button type="button" variant="ghost" size="icon" className="min-h-10 min-w-10" onClick={() => navigateDate(moveRoomOverviewDate(selectedDate, -movementDays))} aria-label={calendarMode ? "이전 기간" : "이전 날짜"}><ChevronLeft /></Button>
        <button type="button" className="min-h-10 min-w-0 flex-1 rounded-lg px-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={goToday}>
          <span className="block truncate text-sm font-bold">{format(selected, calendarMode ? "yyyy년 M월" : "yyyy년 M월 d일", { locale: ko })}</span>
          <span className="block text-[10px] text-muted-foreground">{calendarMode ? `${calendarRangeDays}일 타임라인` : format(selected, "EEEE", { locale: ko })}{isToday ? " · 오늘" : ""}</span>
        </button>
        <Button type="button" variant="ghost" size="icon" className="min-h-10 min-w-10" onClick={() => navigateDate(moveRoomOverviewDate(selectedDate, movementDays))} aria-label={calendarMode ? "다음 기간" : "다음 날짜"}><ChevronRight /></Button>
        <Button type="button" variant={isToday ? "secondary" : "outline"} size="sm" className="min-h-10 px-3" onClick={goToday}>오늘</Button>
      </section>

      <section aria-label="객실 상태 요약" className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {summaryItems.map((item) => {
          const active = filters.status === item.key;
          return <button key={item.key} type="button" aria-pressed={active} onClick={() => onStatusChange(active && item.key !== "ALL" ? "ALL" : item.key)} className={cn("flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", active && "border-primary bg-primary/10 text-primary", item.key === "CONFLICT" && "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300", active && item.key === "CONFLICT" && "bg-red-100 dark:bg-red-950")}><span>{item.label}</span><strong className="tabular-nums">{summary[item.count]}</strong></button>;
        })}
      </section>

      {calendarMode ? <section aria-label="캘린더 보기와 필터" className="flex items-center gap-2 rounded-xl border bg-card p-1.5">
        <div className="min-w-0 flex-1">{viewControl}</div>
        <span className="shrink-0 text-[10px] text-muted-foreground">{resultCount}개</span>
        <RoomStatusFilterSheet filters={filters} propertyId={propertyId} properties={properties} onApply={onFiltersApply} onReset={onFiltersReset} />
        <Button type="button" variant={selectionMode ? "secondary" : "outline"} size="icon" className="min-h-10 min-w-10" onClick={() => onSelectionModeChange(!selectionMode)} aria-pressed={selectionMode} aria-label={selectionMode ? "선택 모드 종료" : "객실 선택 모드"}><SquareCheckBig /></Button>
        {canSync && <RoomOverviewSync propertyId={propertyId} compact />}
      </section> : <section aria-label="객실 검색과 필터" className="space-y-2 rounded-xl border bg-card p-2">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <input value={filters.query} onChange={(event) => onQueryChange(event.target.value)} aria-label="객실 번호, 객실명 또는 숙소명 검색" placeholder="객실·숙소 검색" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <RoomStatusFilterSheet filters={filters} propertyId={propertyId} properties={properties} onApply={onFiltersApply} onReset={onFiltersReset} />
          <Button type="button" variant={selectionMode ? "secondary" : "outline"} size="icon" className="min-h-10 min-w-10" onClick={() => onSelectionModeChange(!selectionMode)} aria-pressed={selectionMode} aria-label={selectionMode ? "선택 모드 종료" : "객실 선택 모드"}><SquareCheckBig /></Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          {viewControl}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{resultCount}개</span>
            {canSync && <RoomOverviewSync propertyId={propertyId} compact />}
          </div>
        </div>
      </section>}
    </div>
  );
}
