"use client";

import type { RoomOverviewCard } from "../domain/room-overview";
import { CompactRoomStatusCard } from "./compact-room-status-card";

export function RoomStatusCardGrid({ rooms, selectionMode, selectedIds, onActivate }: {
  rooms: RoomOverviewCard[];
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  onActivate: (room: RoomOverviewCard) => void;
}) {
  return <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3 lg:grid-cols-4">{rooms.map((room) => <CompactRoomStatusCard key={room.id} room={room} selectionMode={selectionMode} selected={selectedIds.has(room.id)} onActivate={() => onActivate(room)} />)}</div>;
}

