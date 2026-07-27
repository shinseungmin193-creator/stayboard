"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isCalendarRangeDays, type CalendarRangeDays } from "../domain/room-overview-mobile";

const STORAGE_KEY = "stayboard:room-overview:calendar-range";

function replaceRangeInUrl(router: ReturnType<typeof useRouter>, range: CalendarRangeDays) {
  const params = new URLSearchParams(window.location.search);
  params.set("range", String(range));
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  router.refresh();
}

export function useRoomTimelineRange(initialRange: CalendarRangeDays, hasQueryRange: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (hasQueryRange) return;
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (isCalendarRangeDays(stored) && stored !== initialRange) replaceRangeInUrl(router, stored);
  }, [hasQueryRange, initialRange, router]);

  const setRange = (next: CalendarRangeDays) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // The URL remains the source of truth when browser storage is unavailable.
    }
    replaceRangeInUrl(router, next);
  };

  return { rangeDays: initialRange, setRange };
}
