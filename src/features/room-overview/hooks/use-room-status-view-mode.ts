"use client";

import { useSyncExternalStore } from "react";
import { ROOM_STATUS_VIEW_MODES, type RoomStatusViewMode } from "../domain/room-overview-mobile";

const STORAGE_KEY = "stayboard:room-overview:view";
const VIEW_CHANGE_EVENT = "stayboard:room-overview:view-change";

export function isRoomStatusViewMode(value: unknown): value is RoomStatusViewMode {
  return typeof value === "string" && ROOM_STATUS_VIEW_MODES.includes(value as RoomStatusViewMode);
}

function writeViewToUrl(view: RoomStatusViewMode) {
  const params = new URLSearchParams(window.location.search);
  params.set("view", view);
  window.history.replaceState(null, "", `?${params.toString()}`);
  window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
}

export function useRoomStatusViewMode(queryView?: string) {
  const serverMode = isRoomStatusViewMode(queryView) ? queryView : "card";
  const viewMode = useSyncExternalStore(
    (notify) => {
      window.addEventListener("popstate", notify);
      window.addEventListener("storage", notify);
      window.addEventListener(VIEW_CHANGE_EVENT, notify);
      return () => {
        window.removeEventListener("popstate", notify);
        window.removeEventListener("storage", notify);
        window.removeEventListener(VIEW_CHANGE_EVENT, notify);
      };
    },
    () => {
      const queryMode = new URLSearchParams(window.location.search).get("view");
      if (isRoomStatusViewMode(queryMode)) return queryMode;
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return isRoomStatusViewMode(stored) ? stored : "card";
    },
    () => serverMode,
  );

  const setViewMode = (next: RoomStatusViewMode) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    writeViewToUrl(next);
  };

  return { viewMode, setViewMode };
}
