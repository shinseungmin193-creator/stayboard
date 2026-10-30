"use client";

import { groupRoomOverviewByProperty, type RoomOverviewCard } from "../domain/room-overview";
import { useCollapsedRoomGroups } from "../hooks/use-collapsed-room-groups";
import { CompactRoomStatusCard } from "./compact-room-status-card";
import { MobileRoomPropertyGroupHeader } from "./mobile-room-property-group-header";

export function RoomStatusCardGrid({ rooms, selectionMode, selectedIds, canCreateRoomNotes, canReadRoomAccessPassword, canManageRoomAccessPassword, onActivate, onInspectionActivate, onCreateRoomNote }: {
  rooms: RoomOverviewCard[];
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  canCreateRoomNotes: boolean;
  canReadRoomAccessPassword: boolean;
  canManageRoomAccessPassword: boolean;
  onActivate: (room: RoomOverviewCard) => void;
  onInspectionActivate?: (room: RoomOverviewCard) => void;
  onCreateRoomNote: (room: RoomOverviewCard) => void;
}) {
  const groups = groupRoomOverviewByProperty(rooms, { preserveRoomOrder: true });
  const { collapsedIds, toggleGroup } = useCollapsedRoomGroups();

  return <div className="space-y-3">
    {groups.map((group) => {
      const collapsed = collapsedIds.has(group.id);
      return <section key={group.id} data-property-id={group.id} aria-label={group.name} className="overflow-hidden rounded-xl border bg-card">
        <MobileRoomPropertyGroupHeader group={group} collapsed={collapsed} onToggle={() => toggleGroup(group.id)} />
        {!collapsed && <div className="grid grid-cols-2 items-start gap-2 p-2 sm:grid-cols-3 lg:grid-cols-4">
          {group.rooms.map((room) => <CompactRoomStatusCard key={room.id} room={room} selectionMode={selectionMode} selected={selectedIds.has(room.id)} canCreateRoomNotes={canCreateRoomNotes} canReadRoomAccessPassword={canReadRoomAccessPassword} canManageRoomAccessPassword={canManageRoomAccessPassword} onActivate={() => onActivate(room)} onInspectionActivate={onInspectionActivate} onCreateRoomNote={onCreateRoomNote} />)}
        </div>}
      </section>;
    })}
  </div>;
}
