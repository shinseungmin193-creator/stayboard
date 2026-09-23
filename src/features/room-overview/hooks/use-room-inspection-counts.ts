"use client";

import { useCallback, useMemo, useState } from "react";

import type { RoomOverviewCard } from "../domain/room-overview";

export function useRoomInspectionCounts(rooms: readonly RoomOverviewCard[]) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, { sourceCount: number; count: number }>>(() => new Map());

  const updatePendingMemoCount = useCallback((roomId: string, count: number) => {
    const sourceCount = rooms.find((room) => room.id === roomId)?.pendingMemoCount ?? count;
    setOverrides((current) => {
      const next = new Map(current);
      next.set(roomId, { sourceCount, count: Math.max(0, count) });
      return next;
    });
  }, [rooms]);

  const resolvedRooms = useMemo(() => rooms.map((room) => {
    const override = overrides.get(room.id);
    if (!override || room.pendingMemoCount === override.count || room.pendingMemoCount !== override.sourceCount) return room;
    return { ...room, pendingMemoCount: override.count };
  }), [overrides, rooms]);

  return { rooms: resolvedRooms, updatePendingMemoCount };
}
