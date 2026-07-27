"use client";

import { useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "stayboard:room-overview:collapsed-groups";
const CHANGE_EVENT = "stayboard:room-overview:collapsed-groups-change";

function parseStoredGroups(serialized: string) {
  try {
    const value: unknown = JSON.parse(serialized);
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function useCollapsedRoomGroups() {
  const serialized = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener(CHANGE_EVENT, notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener(CHANGE_EVENT, notify);
      };
    },
    () => window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    () => "[]",
  );
  const collapsedIds = useMemo(() => parseStoredGroups(serialized), [serialized]);

  const toggleGroup = (groupId: string) => {
    const next = new Set(collapsedIds);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return { collapsedIds, toggleGroup };
}
