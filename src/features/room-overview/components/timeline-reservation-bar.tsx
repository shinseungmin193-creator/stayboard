"use client";import { useTranslations, useLocale } from "next-intl";

import { cn } from "@/lib/utils";
import { getProviderVisual, RESERVATION_CONFLICT_VISUAL } from "@/features/reservations/provider-visuals";
import { TIMELINE_RESERVATION_HEIGHT, type MobileRoomCalendarSegment } from "../domain/room-overview-mobile";

export function TimelineReservationBar({ segment, columnWidth, onActivate }: {segment: MobileRoomCalendarSegment;columnWidth: number;onActivate: () => void;}) {const locale = useLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const i18n = useTranslations();
  const visual = getProviderVisual(segment.provider);
  const width = Math.max(22, segment.durationDays * columnWidth - 6);
  return <button type="button" onClick={(event) => {event.stopPropagation();onActivate();}} className={cn("absolute z-10 flex items-center overflow-hidden rounded-full border px-2 text-[9px] font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", visual.className, segment.hasConflict && RESERVATION_CONFLICT_VISUAL)} style={{ left: segment.leftDays * columnWidth + 3, top: 3 + segment.lane * (TIMELINE_RESERVATION_HEIGHT + 2), width, height: TIMELINE_RESERVATION_HEIGHT }} aria-label={i18n("auto.m0536", { value0: visual.label, value1: segment.reservation.startDate.toLocaleDateString(localeTag), value2: segment.reservation.endDate.toLocaleDateString(localeTag), value3: segment.hasConflict ? i18n("auto.m0537") : "" })}>
    <span className="truncate">{visual.shortLabel}</span>
  </button>;
}
