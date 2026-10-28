"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RoomOperationalStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { type RoomOverviewCleaningFilter, type RoomOverviewStatus } from "../domain/room-overview";
import { moveRoomOverviewDate, roomOverviewDateInstant } from "../domain/room-overview-mobile";
import type { DesktopRoomOverviewViewMode } from "../hooks/use-desktop-room-overview-view-mode";
import { ROOM_STATUS_THEME, type RoomOverviewVisualStatus } from "../room-overview-visuals";
import { RoomOverviewFilterForm } from "./room-overview-filter-form";
import { RoomOverviewRefresh } from "./room-overview-refresh";
import { RoomOverviewSync } from "./room-overview-sync";

interface ToolbarProps {
  properties: Array<{ id: string; name: string; isActive: boolean }>;
  filters: {
    propertyId?: string;
    query?: string;
    status?: RoomOverviewStatus;
    cleaningStatus?: RoomOverviewCleaningFilter;
    operationalStatus?: RoomOperationalStatus;
    syncStatus?: SyncStatus;
  };
  summary: {
    total: number;
    statuses: Record<RoomOverviewStatus, number>;
    cleaningStatuses: Record<RoomOverviewCleaningFilter, number>;
    operationalStatuses: Record<RoomOperationalStatus, number>;
  };
  currentParams: Array<[string, string]>;
  selectedDate: string;
  today: string;
  canSync: boolean;
  viewMode: DesktopRoomOverviewViewMode;
  onViewModeChange: (mode: DesktopRoomOverviewViewMode) => void;
}

function SummaryChip({ label, value, status, active = false, href, className }: {
  label: string;
  value: number;
  status?: RoomOverviewVisualStatus;
  active?: boolean;
  href: string;
  className?: string;
}) {
  const theme = status ? ROOM_STATUS_THEME[status] : null;
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      className={cn(
        "flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        theme ? theme.badgeClass : "border-border bg-card",
        active && !status && "border-primary/45 bg-primary/10",
        className,
        active && "ring-2 ring-primary/35 ring-offset-1 ring-offset-background",
      )}
    >
      <span className={cn(!theme && "text-muted-foreground")}>{label}</span>
      <strong className={cn("font-bold tabular-nums", !theme && "text-foreground")}>{value}</strong>
    </Link>
  );
}

export function RoomOverviewToolbar(props: ToolbarProps) {
  const locale = useLocale();
  const i18n = useTranslations();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const selectedDateLabel = new Intl.DateTimeFormat(localeTag, {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(roomOverviewDateInstant(props.selectedDate));
  const compactStatuses = [
    { status: "VACANT", label: i18n("reservation.vacant") },
    { status: "OCCUPIED", label: i18n("reservation.statuses.STAYING") },
    { status: "CHECK_IN_TODAY", label: i18n("reservation.checkIn") },
    { status: "CHECK_OUT_TODAY", label: i18n("reservation.checkOut") },
    { status: "CONFLICT", label: i18n("reservation.overbooking") },
  ] as const;

  const hrefWith = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(props.currentParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `/room-overview${params.size ? `?${params}` : ""}`;
  };
  const statusHref = (status?: RoomOverviewStatus) => hrefWith({
    status: status && status !== props.filters.status ? status : undefined,
  });
  const inspectionHref = hrefWith({
    operationalStatus: props.filters.operationalStatus === "INSPECTION_REQUIRED" ? undefined : "INSPECTION_REQUIRED",
  });
  const cleaningHref = (cleaningStatus: RoomOverviewCleaningFilter) => hrefWith({
    cleaningStatus: props.filters.cleaningStatus === cleaningStatus ? undefined : cleaningStatus,
  });
  const previousDate = moveRoomOverviewDate(props.selectedDate, -1);
  const nextDate = moveRoomOverviewDate(props.selectedDate, 1);

  return (
    <section aria-label={i18n("navigation.items.room-overview")} className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex min-h-12 items-center gap-2 border-b px-3">
        <h1 className="mr-1 shrink-0 text-base font-bold">{i18n("navigation.items.room-overview")}</h1>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:thin]">
          <SummaryChip href={statusHref()} label={i18n("auto.m0102")} value={props.summary.total} active={!props.filters.status} />
          {compactStatuses.map((item) => (
            <SummaryChip key={item.status} href={statusHref(item.status)} label={item.label} value={props.summary.statuses[item.status]} status={item.status} active={props.filters.status === item.status} />
          ))}
          <SummaryChip href={cleaningHref("INCOMPLETE")} label={i18n("roomOverviewList.cleaningIncomplete")} value={props.summary.cleaningStatuses.INCOMPLETE} active={props.filters.cleaningStatus === "INCOMPLETE"} className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-200" />
          <SummaryChip href={cleaningHref("COMPLETED")} label={i18n("roomOverviewList.cleaningCompleted")} value={props.summary.cleaningStatuses.COMPLETED} active={props.filters.cleaningStatus === "COMPLETED"} className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200" />
          <SummaryChip href={inspectionHref} label={i18n("roomStatus.INSPECTION_REQUIRED")} value={props.summary.operationalStatuses.INSPECTION_REQUIRED} status="INSPECTION_REQUIRED" active={props.filters.operationalStatus === "INSPECTION_REQUIRED"} />
        </div>

        <div className="ml-auto flex shrink-0 items-center rounded-lg border bg-background">
          <Button nativeButton={false} render={<Link href={hrefWith({ date: previousDate })} />} variant="ghost" size="icon-sm" aria-label={i18n("roomOverviewList.previousDay")}><ChevronLeft /></Button>
          <span className="min-w-40 border-x px-3 text-center text-xs font-semibold tabular-nums">{selectedDateLabel}</span>
          <Button nativeButton={false} render={<Link href={hrefWith({ date: nextDate })} />} variant="ghost" size="icon-sm" aria-label={i18n("roomOverviewList.nextDay")}><ChevronRight /></Button>
        </div>
        <Button nativeButton={false} render={<Link href={hrefWith({ date: props.today === props.selectedDate ? undefined : props.today })} />} variant="outline" size="sm">{i18n("common.today")}</Button>
      </div>

      <div className="flex min-h-12 items-center gap-2 px-3">
        <RoomOverviewFilterForm properties={props.properties} filters={props.filters} currentParams={props.currentParams} className="grid min-w-0 flex-1 grid-cols-[112px_minmax(140px,1fr)_112px_112px_auto] items-center gap-2" />
        <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-background p-0.5" aria-label={i18n("roomOverviewList.viewMode")}>
          <Button type="button" size="sm" variant={props.viewMode === "list" ? "default" : "ghost"} className="h-7 px-2.5" aria-pressed={props.viewMode === "list"} onClick={() => props.onViewModeChange("list")}><List />{i18n("roomOverviewList.listView")}</Button>
          <Button type="button" size="sm" variant={props.viewMode === "card" ? "default" : "ghost"} className="h-7 px-2.5" aria-pressed={props.viewMode === "card"} onClick={() => props.onViewModeChange("card")}><LayoutGrid />{i18n("roomOverviewList.cardView")}</Button>
        </div>
        {props.canSync && <RoomOverviewSync propertyId={props.filters.propertyId} compact />}
        <RoomOverviewRefresh compact />
      </div>
    </section>
  );
}
