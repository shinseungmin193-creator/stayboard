"use client";

import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { TIMELINE_ROOM_COLUMN_WIDTH } from "../domain/room-overview-mobile";

export function TimelineGroupHeader({ label, roomCount, reservationCount, conflictCount, collapsed, timelineWidth, onToggle }: { label: string; roomCount: number; reservationCount: number; conflictCount: number; collapsed: boolean; timelineWidth: number; onToggle: () => void }) {
  const Icon = collapsed ? ChevronRight : ChevronDown;
  return <div className="flex h-9 border-b bg-muted/35">
    <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="sticky left-0 z-30 flex shrink-0 items-center gap-1 border-r bg-muted px-2 text-left outline-none hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" style={{ width: TIMELINE_ROOM_COLUMN_WIDTH }}>
      <Icon className="size-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate text-[10px] font-bold">{label}</span><span className="text-[9px] tabular-nums text-muted-foreground">{roomCount}</span>
    </button>
    <div className="flex items-center gap-3 px-2 text-[9px] text-muted-foreground" style={{ width: timelineWidth }}><span>예약 {reservationCount}</span>{conflictCount > 0 && <span className="flex items-center gap-1 font-semibold text-destructive"><AlertTriangle className="size-3" />오버부킹 {conflictCount}</span>}</div>
  </div>;
}
