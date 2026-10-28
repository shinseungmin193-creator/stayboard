"use client";

import { useCallback, useMemo, useState } from "react";

import type { RoomInspectionStatus, RoomOverviewCard } from "../domain/room-overview";

export function useRoomInspectionCounts(rooms: readonly RoomOverviewCard[]) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, { sourceCount: number; count: number; inspectionStatus?: RoomInspectionStatus }>>(() => new Map());

  const updatePendingMemoCount = useCallback((roomId: string, count: number, inspectionStatus?: RoomInspectionStatus) => {
    const sourceCount = rooms.find((room) => room.id === roomId)?.pendingMemoCount ?? count;
    setOverrides((current) => {
      const next = new Map(current);
      next.set(roomId, { sourceCount, count: Math.max(0, count), inspectionStatus });
      return next;
    });
  }, [rooms]);

  const resolvedRooms = useMemo(() => rooms.map((room) => {
    const override = overrides.get(room.id);
    if (!override) return room;
    if (room.pendingMemoCount !== override.sourceCount && room.pendingMemoCount !== override.count) return room;
    if (room.pendingMemoCount === override.count && (!override.inspectionStatus || room.inspectionStatus === override.inspectionStatus)) return room;
    return {
      ...room,
      pendingMemoCount: override.count,
      inspectionStatus: override.inspectionStatus ?? room.inspectionStatus,
    };
  }), [overrides, rooms]);

  return { rooms: resolvedRooms, updatePendingMemoCount };
}
