"use client";

import { useTranslations } from "next-intl";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RoomOverviewPropertyGroup, RoomOverviewStatus } from "../domain/room-overview";
import { ROOM_STATUS_THEME } from "../room-overview-visuals";

const GROUP_STATUS_ORDER = ["CHECK_IN_TODAY", "CHECK_OUT_TODAY", "OCCUPIED", "VACANT", "CONFLICT"] as const satisfies readonly RoomOverviewStatus[];

function MobileGroupMetric({ status, count }: { status: RoomOverviewStatus; count: number }) {
  const i18n = useTranslations();
  if (!count) return null;
  const theme = ROOM_STATUS_THEME[status];
  return <Badge variant="outline" className={cn("h-5 px-1.5 text-[9px]", theme.badgeClass)}>{i18n(theme.labelKey)} {count}</Badge>;
}

export function MobileRoomPropertyGroupHeader({ group, collapsed, onToggle }: {
  group: RoomOverviewPropertyGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const i18n = useTranslations();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex min-h-11 w-full flex-wrap items-center gap-1.5 border-y bg-muted/55 px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
      <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
      <strong className="text-xs">{group.name}</strong>
      <span className="text-[10px] text-muted-foreground">{i18n("roomOverviewList.roomCount", { count: group.rooms.length })}</span>
      <span className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
        {GROUP_STATUS_ORDER.map((status) => <MobileGroupMetric key={status} status={status} count={group.summary.statuses[status]} />)}
      </span>
    </button>
  );
}
