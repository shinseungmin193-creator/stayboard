"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { addDays, differenceInCalendarDays, format, isSameDay } from "date-fns";
import type { RoomStatusRoom } from "@/features/room-status/room-status.types";
import { getReservationDisplayLabel } from "@/features/reservations/reservation-display";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import { RESERVATION_CONFLICT_UI } from "@/features/reservation-conflicts/reservation-conflict.labels";
import { CALENDAR_PROVIDER_LABELS, getCalendarProviderLabel, isCalendarProviderType } from "@/providers/calendar/types";

const DAY_WIDTH = 64;
const ROOM_WIDTH = 176;

const providerStyle: Record<string, string> = {
  AIRBNB: "border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
  BOOKING: "border-blue-300 bg-blue-100 text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
  AGODA: "border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100",
};

function dayStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function MonthlyReservationCalendar({
  rooms,
  rangeStart,
  dayCount,
  today,
}: {
  rooms: RoomStatusRoom[];
  rangeStart: string;
  dayCount: number;
  today: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const start = useMemo(() => new Date(`${rangeStart}T00:00:00+09:00`), [rangeStart]);
  const todayDate = useMemo(() => new Date(`${today}T00:00:00+09:00`), [today]);
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => addDays(start, index)), [dayCount, start]);
  const todayIndex = differenceInCalendarDays(todayDate, start);

  const scrollToToday = () => {
    if (!viewportRef.current || todayIndex < 0 || todayIndex >= dayCount) return;
    viewportRef.current.scrollTo({ left: Math.max(0, todayIndex * DAY_WIDTH - 180), behavior: "smooth" });
  };

  useEffect(() => {
    if (todayIndex >= 0 && todayIndex < dayCount && viewportRef.current) {
      viewportRef.current.scrollLeft = Math.max(0, todayIndex * DAY_WIDTH - 180);
    }
  }, [dayCount, todayIndex]);

  if (rooms.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center rounded-xl border bg-card p-6 text-center">
        <div>
          <CalendarDays className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="font-medium">표시할 활성 객실이 없습니다</p>
          <p className="mt-1 text-sm text-muted-foreground">객실과 숙소의 활성 상태를 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm" aria-label="월간 예약 캘린더">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-xs text-muted-foreground">막대를 눌러 예약 기간과 공급자를 확인할 수 있습니다.</p>
        <Button type="button" variant="outline" size="sm" onClick={scrollToToday} disabled={todayIndex < 0 || todayIndex >= dayCount}>
          오늘 위치
        </Button>
      </div>
      <div ref={viewportRef} className="max-h-[calc(100dvh-18rem)] overflow-auto overscroll-contain">
        <div className="relative" style={{ width: ROOM_WIDTH + dayCount * DAY_WIDTH }}>
          <div className="sticky top-0 z-30 flex h-14 border-b bg-card/95 backdrop-blur">
            <div className="sticky left-0 z-40 flex shrink-0 items-center border-r bg-card px-3 text-xs font-semibold" style={{ width: ROOM_WIDTH }}>
              객실 · {rooms.length}개
            </div>
            {days.map((day) => {
              const isToday = isSameDay(day, todayDate);
              const weekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div key={day.toISOString()} className={cn("grid shrink-0 place-items-center border-r text-center", weekend && "bg-muted/40", isToday && "bg-primary/10")} style={{ width: DAY_WIDTH }}>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{format(day, "M월")}</p>
                    <p className={cn("text-sm font-semibold", isToday && "text-primary")}>{format(day, "d EEE")}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {rooms.map((room) => {
            return <div key={room.id} className="relative flex min-h-20 border-b last:border-b-0">
              <div className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r bg-card px-3" style={{ width: ROOM_WIDTH }}>
                <p className="truncate text-sm font-semibold">{formatRoomDisplayName(room)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{room.propertyName}</p>
                <div className="mt-1 flex flex-wrap gap-1 overflow-hidden" aria-label="연결된 Provider">
                  {room.sources.map((source) => isCalendarProviderType(source.provider) ? <Badge key={source.id} variant="outline" className="h-4 px-1 text-[9px]">{CALENDAR_PROVIDER_LABELS[source.provider]}</Badge> : null)}
                </div>
              </div>
              <div className="relative h-20" style={{ width: dayCount * DAY_WIDTH }}>
                <div className="absolute inset-0 flex">
                  {days.map((day) => <div key={day.toISOString()} className={cn("h-full shrink-0 border-r", (day.getDay() === 0 || day.getDay() === 6) && "bg-muted/25", isSameDay(day, todayDate) && "bg-primary/7")} style={{ width: DAY_WIDTH }} />)}
                </div>
                {room.reservations.map((reservation, index) => {
                  const providerLabel = getCalendarProviderLabel(reservation.provider);
                  if (!providerLabel) return null;
                  const reservationStart = dayStart(reservation.startDate);
                  const reservationEnd = dayStart(reservation.endDate);
                  const leftDays = Math.max(0, differenceInCalendarDays(reservationStart, start));
                  const endDays = Math.min(dayCount, differenceInCalendarDays(reservationEnd, start));
                  const widthDays = Math.max(1, endDays - leftDays);
                  if (endDays <= 0 || leftDays >= dayCount) return null;
                  const label = getReservationDisplayLabel(reservation, "예약");
                  return (
                    <div
                      key={reservation.id}
                      className={cn("absolute z-10 flex h-7 items-center gap-1 overflow-hidden rounded-md border px-2 text-[11px] font-medium shadow-sm", providerStyle[reservation.provider], reservation.hasActiveConflict && "border-destructive ring-2 ring-destructive/40")}
                      style={{ left: leftDays * DAY_WIDTH + 4, top: 9 + (index % 2) * 34, width: Math.max(24, widthDays * DAY_WIDTH - 8) }}
                      title={`${label} · ${format(reservation.startDate, "yyyy-MM-dd")} → ${format(reservation.endDate, "yyyy-MM-dd")} · ${providerLabel} · ${reservation.calendarSourceName}`}
                    >
                      {reservation.hasActiveConflict && <AlertTriangle className="size-3 shrink-0" aria-label={RESERVATION_CONFLICT_UI.label} />}
                      <span className="truncate">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>;
          })}
          {todayIndex >= 0 && todayIndex < dayCount && <div className="pointer-events-none absolute bottom-0 top-14 z-10 w-px bg-primary" style={{ left: ROOM_WIDTH + todayIndex * DAY_WIDTH + DAY_WIDTH / 2 }} />}
        </div>
      </div>
    </section>
  );
}
