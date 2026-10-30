"use client";

import type { RoomOverviewCard } from "../domain/room-overview";
import { CompactRoomStatusCard } from "./compact-room-status-card";

export function RoomStatusCardGrid({ rooms, selectionMode, selectedIds, canCreateRoomNotes, onActivate, onInspectionActivate, onCreateRoomNote }: {
  rooms: RoomOverviewCard[];
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  canCreateRoomNotes: boolean;
  onActivate: (room: RoomOverviewCard) => void;
  onInspectionActivate?: (room: RoomOverviewCard) => void;
  onCreateRoomNote: (room: RoomOverviewCard) => void;
}) {
  return <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3 lg:grid-cols-4">{rooms.map((room) => <CompactRoomStatusCard key={room.id} room={room} selectionMode={selectionMode} selected={selectedIds.has(room.id)} canCreateRoomNotes={canCreateRoomNotes} onActivate={() => onActivate(room)} onInspectionActivate={onInspectionActivate} onCreateRoomNote={onCreateRoomNote} />)}</div>;
}
