import { cn } from "@/lib/utils";
import { roomOverviewDateInstant, TIMELINE_ROOM_COLUMN_WIDTH } from "../domain/room-overview-mobile";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", day: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", weekday: "short" });

export function TimelineDateHeader({ days, today, columnWidth, roomCount }: { days: string[]; today: string; columnWidth: number; roomCount: number }) {
  return <div className="sticky top-0 z-40 flex h-12 border-b bg-card">
    <div className="sticky left-0 z-50 flex shrink-0 items-center border-r bg-card px-2 text-[10px] font-bold" style={{ width: TIMELINE_ROOM_COLUMN_WIDTH }}>객실 {roomCount}</div>
    {days.map((dateKey) => {
      const date = roomOverviewDateInstant(dateKey);
      const weekday = date.getDay();
      const isToday = dateKey === today;
      return <div key={dateKey} data-date={dateKey} className={cn("grid shrink-0 place-items-center border-r bg-card text-center", weekday === 0 && "text-red-600 dark:text-red-400", weekday === 6 && "text-blue-600 dark:text-blue-400")} style={{ width: columnWidth }}>
        <div><strong className={cn("mx-auto grid size-6 place-items-center rounded-full text-xs tabular-nums", isToday && "bg-primary text-primary-foreground")}>{dateFormatter.format(date)}</strong><span className="mt-0.5 block text-[9px]">{weekdayFormatter.format(date)}</span></div>
      </div>;
    })}
  </div>;
}
