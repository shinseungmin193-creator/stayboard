"use client";

import { AlertTriangle, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProviderVisual } from "@/features/reservations/provider-visuals";
import type { MobileRoomCalendarSegment } from "../domain/room-overview-mobile";

export function TimelineReservationBar({ segment, columnWidth, onActivate }: { segment: MobileRoomCalendarSegment; columnWidth: number; onActivate: () => void }) {
  const visual = getProviderVisual(segment.provider);
  const width = Math.max(22, segment.durationDays * columnWidth - 6);
  return <button type="button" onClick={(event) => { event.stopPropagation(); onActivate(); }} className={cn("absolute z-10 flex items-center gap-1 overflow-hidden rounded-md border border-amber-400 bg-amber-100 px-1.5 text-[9px] font-semibold text-amber-950 shadow-sm outline-none dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100", segment.hasConflict && "border-destructive bg-red-50 ring-2 ring-destructive/70 dark:border-red-700 dark:bg-red-950")} style={{ left: segment.leftDays * columnWidth + 3, top: 4 + segment.lane * 24, width, height: 22 }} aria-label={`${visual.label} 예약, ${segment.reservation.startDate.toLocaleDateString("ko-KR")}부터 ${segment.reservation.endDate.toLocaleDateString("ko-KR")}까지${segment.hasConflict ? ", 오버부킹" : ""}`}>
    {segment.startsInRange && <span className="absolute inset-y-0 left-0 w-1 bg-blue-500" aria-hidden="true" />}
    {segment.hasConflict && <AlertTriangle className="size-3 shrink-0 text-destructive" />}
    {segment.startsInRange && width >= 52 && <LogIn className="size-3 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
    <span className="truncate">{visual.shortLabel}</span>
    {segment.endsInRange && width >= 70 && <LogOut className="ml-auto size-3 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />}
    {segment.endsInRange && <span className="absolute inset-y-0 right-0 w-1 bg-violet-500" aria-hidden="true" />}
  </button>;
}
