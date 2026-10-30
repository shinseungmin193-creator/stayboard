"use client";

import { useCallback, useMemo, useState } from "react";

import type { RoomInspectionStatus, RoomOverviewCard } from "../domain/room-overview";

export function useRoomInspectionCounts(rooms: readonly RoomOverviewCard[]) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, { sourceCount: number; count: number; inspectionStatus?: RoomInspectionStatus }>>(() => new Map());
  const [insuranceOverrides, setInsuranceOverrides] = useState<ReadonlyMap<string, { sourceCount: number; count: number }>>(() => new Map());

  const updatePendingMemoCount = useCallback((roomId: string, count: number, inspectionStatus?: RoomInspectionStatus) => {
    const sourceCount = rooms.find((room) => room.id === roomId)?.pendingMemoCount ?? count;
    setOverrides((current) => {
      const next = new Map(current);
      next.set(roomId, { sourceCount, count: Math.max(0, count), inspectionStatus });
      return next;
    });
  }, [rooms]);

  const updateInsuranceClaimCount = useCallback((roomId: string, count: number) => {
    const sourceCount = rooms.find((room) => room.id === roomId)?.insuranceClaimCount ?? count;
    setInsuranceOverrides((current) => {
      const next = new Map(current);
      next.set(roomId, { sourceCount, count: Math.max(0, count) });
      return next;
    });
  }, [rooms]);

  const resolvedRooms = useMemo(() => rooms.map((room) => {
    const override = overrides.get(room.id);
    const insuranceOverride = insuranceOverrides.get(room.id);
    const inspectionChanged = override && (room.pendingMemoCount === override.sourceCount || room.pendingMemoCount === override.count);
    const insuranceChanged = insuranceOverride && (room.insuranceClaimCount === insuranceOverride.sourceCount || room.insuranceClaimCount === insuranceOverride.count);
    if (!inspectionChanged && !insuranceChanged) return room;
    return {
      ...room,
      ...(inspectionChanged ? { pendingMemoCount: override.count, inspectionStatus: override.inspectionStatus ?? room.inspectionStatus } : {}),
      ...(insuranceChanged ? { insuranceClaimCount: insuranceOverride.count } : {}),
    };
  }), [insuranceOverrides, overrides, rooms]);

  return { rooms: resolvedRooms, updatePendingMemoCount, updateInsuranceClaimCount };
}
