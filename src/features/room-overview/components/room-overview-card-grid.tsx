"use client";

import { useState } from "react";

import type { RoomOverviewCard as RoomOverviewCardData } from "../domain/room-overview";
import { useRoomInspectionCounts } from "../hooks/use-room-inspection-counts";
import { RoomInspectionDialog } from "./room-inspection-dialog";
import { RoomOverviewCard } from "./room-overview-card";
import styles from "./room-overview-visuals.module.css";

export function RoomOverviewCardGrid({ cards, canUpdateOperationalStatus, canReadRoomNotes, canCompleteRoomNotes }: {
  cards: RoomOverviewCardData[];
  canUpdateOperationalStatus: boolean;
  canReadRoomNotes: boolean;
  canCompleteRoomNotes: boolean;
}) {
  const { rooms, updatePendingMemoCount } = useRoomInspectionCounts(cards);
  const [inspectionRoomId, setInspectionRoomId] = useState<string | null>(null);
  const inspectionRoom = rooms.find((room) => room.id === inspectionRoomId) ?? null;

  return <>
    <div className={`grid items-start ${styles.roomGrid}`}>
      {rooms.map((card) => <RoomOverviewCard
        key={card.id}
        card={card}
        canUpdateOperationalStatus={canUpdateOperationalStatus}
        onInspectionActivate={canReadRoomNotes ? (room) => setInspectionRoomId(room.id) : undefined}
      />)}
    </div>
    <RoomInspectionDialog
      room={inspectionRoom}
      open={Boolean(inspectionRoom)}
      canComplete={canCompleteRoomNotes}
      onOpenChange={(open) => { if (!open) setInspectionRoomId(null); }}
      onPendingMemoCountChange={updatePendingMemoCount}
    />
  </>;
}
