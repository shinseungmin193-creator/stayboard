"use client";import { useTranslations, useLocale } from "next-intl";

import { AlertTriangle } from "lucide-react";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getZonedDateInput } from "@/lib/zoned-date";
import { cn } from "@/lib/utils";
import { getProviderLabel, getProviderVisual, RESERVATION_CONFLICT_VISUAL } from "@/features/reservations/provider-visuals";
import { TIMELINE_RESERVATION_HEIGHT, type MobileRoomCalendarSegment } from "../domain/room-overview-mobile";

export function TimelineReservationBar({ segment, columnWidth, onActivate }: {segment: MobileRoomCalendarSegment;columnWidth: number;onActivate: () => void;}) {const locale = useLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const i18n = useTranslations();
  const visual = getProviderVisual(segment.provider);
  const width = segment.durationDays * columnWidth;
  const conflictTitle = segment.hasConflict ? [
    i18n("conflict.label"),
    i18n("conflict.overlapDescription"),
    ...segment.reservation.activeConflicts.map((peer) => `${getProviderLabel(peer.provider, i18n)} ${getZonedDateInput(peer.startDate, DEFAULT_TIMEZONE)}–${getZonedDateInput(peer.endDate, DEFAULT_TIMEZONE)}`),
  ].join("\n") : undefined;
  return <button type="button" onClick={(event) => {event.stopPropagation();onActivate();}} className={cn("absolute z-10 flex items-center gap-1 overflow-hidden rounded-full border px-2 text-[9px] font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", visual.className, segment.hasConflict && RESERVATION_CONFLICT_VISUAL)} style={{ left: segment.leftDays * columnWidth, top: 3 + segment.lane * (TIMELINE_RESERVATION_HEIGHT + 2), width, height: TIMELINE_RESERVATION_HEIGHT }} title={conflictTitle} aria-label={i18n("auto.m0536", { value0: visual.label, value1: segment.reservation.startDate.toLocaleDateString(localeTag), value2: segment.reservation.endDate.toLocaleDateString(localeTag), value3: segment.hasConflict ? i18n("auto.m0537") : "" })}>
    {segment.hasConflict && <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />}
    <span className="truncate">{visual.shortLabel}</span>
  </button>;
}
