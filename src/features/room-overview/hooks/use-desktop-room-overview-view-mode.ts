"use client";

import { useSyncExternalStore } from "react";

export const DESKTOP_ROOM_OVERVIEW_VIEW_MODES = ["list", "card"] as const;
export type DesktopRoomOverviewViewMode = (typeof DESKTOP_ROOM_OVERVIEW_VIEW_MODES)[number];

const STORAGE_KEY = "stayboard:room-overview:desktop-view";
const CHANGE_EVENT = "stayboard:room-overview:desktop-view-change";

function isDesktopViewMode(value: unknown): value is DesktopRoomOverviewViewMode {
  return typeof value === "string"
    && DESKTOP_ROOM_OVERVIEW_VIEW_MODES.includes(value as DesktopRoomOverviewViewMode);
}

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

export function useDesktopRoomOverviewViewMode() {
  const viewMode = useSyncExternalStore(
    subscribe,
    () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return isDesktopViewMode(stored) ? stored : "list";
    },
    () => "list" as const,
  );

  const setViewMode = (next: DesktopRoomOverviewViewMode) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return { viewMode, setViewMode };
}
