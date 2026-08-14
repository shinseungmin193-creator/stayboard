"use client";import { useLocale, useTranslations } from "next-intl";

import { useEffect, useMemo, useRef } from "react";
import { CalendarDays } from "lucide-react";
import type { RoomStatusRoom } from "@/features/room-status/room-status.types";
import { ReservationBar } from "@/features/reservations/components/reservation-bar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import { isCalendarProviderType } from "@/providers/calendar/types";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getZonedDateInput, getZonedMidnight, shiftDateInput } from "@/lib/zoned-date";

const DAY_WIDTH = 64;
const ROOM_WIDTH = 176;

function differenceInDateInputs(left: string, right: string) {
  return (Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / (24 * 60 * 60 * 1000);
}

export function MonthlyReservationCalendar({
  rooms,
  rangeStart,
  dayCount,
  today





}: {rooms: RoomStatusRoom[];rangeStart: string;dayCount: number;today: string;}) {const locale = useLocale();const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const i18n = useTranslations();
  const viewportRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => shiftDateInput(rangeStart, index)), [dayCount, rangeStart]);
  const todayIndex = differenceInDateInputs(today, rangeStart);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(localeTag, { timeZone: DEFAULT_TIMEZONE, month: "long" }), [localeTag]);
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(localeTag, { timeZone: DEFAULT_TIMEZONE, day: "numeric", weekday: "short" }), [localeTag]);

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
          <p className="font-medium">{i18n("auto.m0541")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{i18n("auto.m0542")}</p>
        </div>
      </div>);

  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm" aria-label={i18n("auto.m0543")}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-xs text-muted-foreground">{i18n("auto.m0544")}</p>
        <Button type="button" variant="outline" size="sm" onClick={scrollToToday} disabled={todayIndex < 0 || todayIndex >= dayCount}>{i18n("auto.m0509")}

        </Button>
      </div>
      <div ref={viewportRef} className="max-h-[calc(100dvh-18rem)] overflow-auto overscroll-contain">
        <div className="relative" style={{ width: ROOM_WIDTH + dayCount * DAY_WIDTH }}>
          <div className="sticky top-0 z-30 flex h-14 border-b bg-card/95 backdrop-blur">
            <div className="sticky left-0 z-40 flex shrink-0 items-center border-r bg-card px-3 text-xs font-semibold" style={{ width: ROOM_WIDTH }}>{i18n("auto.m0545")}
              {rooms.length}{i18n("auto.m0271")}
            </div>
            {days.map((day) => {
              const dayInstant = getZonedMidnight(day, DEFAULT_TIMEZONE);
              const isToday = day === today;
              const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
              const weekend = weekday === 0 || weekday === 6;
              const labelParts = dayFormatter.formatToParts(dayInstant);
              const labelValue = (type: Intl.DateTimeFormatPartTypes) => labelParts.find((part) => part.type === type)?.value ?? "";
              return (
                <div key={day} className={cn("grid shrink-0 place-items-center border-r text-center", weekend && "bg-muted/40", isToday && "bg-primary/10")} style={{ width: DAY_WIDTH }}>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{monthFormatter.format(dayInstant)}</p>
                    <p className={cn("text-sm font-semibold", isToday && "text-primary")}>{labelValue("day")} {labelValue("weekday")}</p>
                  </div>
                </div>);

            })}
          </div>

          {rooms.map((room) => {
            return <div key={room.id} className="relative flex min-h-20 border-b last:border-b-0">
              <div className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r bg-card px-3" style={{ width: ROOM_WIDTH }}>
                <p className="truncate text-sm font-semibold">{formatRoomDisplayName(room)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{room.propertyName}</p>
                <div className="mt-1 flex flex-wrap gap-1 overflow-hidden" aria-label={i18n("auto.m0547")}>
                  {room.sources.map((source) => isCalendarProviderType(source.provider) ? <Badge key={source.id} variant="outline" className="h-4 px-1 text-[9px]">{getProviderLabel(source.provider, i18n)}</Badge> : null)}
                </div>
              </div>
              <div className="relative h-20" style={{ width: dayCount * DAY_WIDTH }}>
                <div className="absolute inset-0 flex">
                  {days.map((day) => {
                    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
                    return <div key={day} className={cn("h-full shrink-0 border-r", (weekday === 0 || weekday === 6) && "bg-muted/25", day === today && "bg-primary/7")} style={{ width: DAY_WIDTH }} />;
                  })}
                </div>
                {room.reservations.map((reservation, index) => {
                  const reservationStart = getZonedDateInput(reservation.startDate, DEFAULT_TIMEZONE);
                  const reservationEnd = getZonedDateInput(reservation.endDate, DEFAULT_TIMEZONE);
                  const leftDays = Math.max(0, differenceInDateInputs(reservationStart, rangeStart));
                  const endDays = Math.min(dayCount, differenceInDateInputs(reservationEnd, rangeStart));
                  const widthDays = Math.max(1, endDays - leftDays);
                  if (endDays <= 0 || leftDays >= dayCount) return null;
                  const width = Math.max(24, widthDays * DAY_WIDTH - 8);
                  return (
                    <ReservationBar
                      key={reservation.id}
                      {...reservation}
                      roomName={room.name}
                      left={leftDays * DAY_WIDTH + 4}
                      top={9 + index % 2 * 34}
                      width={width} />);


                })}
              </div>
            </div>;
          })}
          {todayIndex >= 0 && todayIndex < dayCount && <div className="pointer-events-none absolute bottom-0 top-14 z-10 w-px bg-primary" style={{ left: ROOM_WIDTH + todayIndex * DAY_WIDTH + DAY_WIDTH / 2 }} />}
        </div>
      </div>
    </section>);

}
