"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BedDouble } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import type { RoomOperationalStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import {
  summarizeRoomOverview,
  type RoomOverviewCard as RoomOverviewCardData,
  type RoomOverviewCleaningFilter,
  type RoomOverviewStatus,
} from "../domain/room-overview";
import { useDesktopRoomOverviewViewMode } from "../hooks/use-desktop-room-overview-view-mode";
import { useRoomInspectionCounts } from "../hooks/use-room-inspection-counts";
import { RoomInspectionDialog } from "./room-inspection-dialog";
import { RoomNoteComposerDialog } from "@/features/room-notes/components/room-note-composer-dialog";
import { InsuranceClaimComposerDialog } from "@/features/insurance-claims/components/insurance-claim-composer-dialog";
import { RoomOverviewCard } from "./room-overview-card";
import { RoomOverviewListView } from "./room-overview-list-view";
import { RoomOverviewToolbar } from "./room-overview-toolbar";
import styles from "./room-overview-visuals.module.css";

export function RoomOverviewDesktopWorkspace({
  initialRooms,
  initialVisibleRooms,
  properties,
  filters,
  currentParams,
  selectedDate,
  today,
  canSync,
  canUpdateOperationalStatus,
  canReadRoomNotes,
  canCreateRoomNotes,
  canUpdateRoomNotes,
  canDeleteRoomNotes,
  canCompleteRoomNotes,
  canCreateInsuranceClaims,
  canReadRoomAccessPassword,
  canManageRoomAccessPassword,
  initialInspectionRoomId,
}: {
  initialRooms: RoomOverviewCardData[];
  initialVisibleRooms: RoomOverviewCardData[];
  properties: Array<{ id: string; name: string; isActive: boolean }>;
  filters: {
    propertyId?: string;
    query?: string;
    status?: RoomOverviewStatus;
    cleaningStatus?: RoomOverviewCleaningFilter;
    operationalStatus?: RoomOperationalStatus;
    syncStatus?: SyncStatus;
  };
  currentParams: Array<[string, string]>;
  selectedDate: string;
  today: string;
  canSync: boolean;
  canUpdateOperationalStatus: boolean;
  canReadRoomNotes: boolean;
  canCreateRoomNotes: boolean;
  canUpdateRoomNotes: boolean;
  canDeleteRoomNotes: boolean;
  canCompleteRoomNotes: boolean;
  canCreateInsuranceClaims: boolean;
  canReadRoomAccessPassword: boolean;
  canManageRoomAccessPassword: boolean;
  initialInspectionRoomId?: string;
}) {
  const i18n = useTranslations();
  const { rooms: allRooms, updatePendingMemoCount, updateInsuranceClaimCount } = useRoomInspectionCounts(initialRooms);
  const { viewMode, setViewMode } = useDesktopRoomOverviewViewMode();
  const [inspectionRoomId, setInspectionRoomId] = useState<string | null>(initialInspectionRoomId ?? null);
  const [composerRoomId, setComposerRoomId] = useState<string | null>(null);
  const [inspectionRefreshKey, setInspectionRefreshKey] = useState(0);
  const [insuranceRoomId, setInsuranceRoomId] = useState<string | null>(null);
  const visibleIds = useMemo(() => new Set(initialVisibleRooms.map((room) => room.id)), [initialVisibleRooms]);
  const visibleRooms = useMemo(() => allRooms.filter((room) => visibleIds.has(room.id)), [allRooms, visibleIds]);
  const summary = useMemo(() => summarizeRoomOverview(allRooms), [allRooms]);
  const inspectionRoom = allRooms.find((room) => room.id === inspectionRoomId) ?? null;
  const composerRoom = allRooms.find((room) => room.id === composerRoomId) ?? null;
  const insuranceRoom = allRooms.find((room) => room.id === insuranceRoomId) ?? null;
  const openInspection = (room: RoomOverviewCardData) => setInspectionRoomId(room.id);
  const closeInspection = () => {
    setInspectionRoomId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("roomId");
    url.searchParams.delete("openMemo");
    window.history.replaceState(window.history.state, "", url);
  };
  const handleCreated = (roomId: string) => {
    const current = allRooms.find((room) => room.id === roomId);
    updatePendingMemoCount(roomId, (current?.pendingMemoCount ?? 0) + 1, "INCOMPLETE");
    if (inspectionRoomId === roomId) setInspectionRefreshKey((value) => value + 1);
  };

  return (
    <div className="hidden space-y-2 xl:block">
      <RoomOverviewToolbar
        properties={properties}
        filters={filters}
        summary={summary}
        currentParams={currentParams}
        selectedDate={selectedDate}
        today={today}
        canSync={canSync}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {visibleRooms.length ? (
        viewMode === "list" ? (
          <RoomOverviewListView
            rooms={visibleRooms}
            canReadRoomNotes={canReadRoomNotes}
            canCreateRoomNotes={canCreateRoomNotes}
            onInspectionActivate={openInspection}
            onCreateRoomNote={(room) => setComposerRoomId(room.id)}
            canCreateInsuranceClaims={canCreateInsuranceClaims}
            canReadRoomAccessPassword={canReadRoomAccessPassword}
            canManageRoomAccessPassword={canManageRoomAccessPassword}
            onCreateInsuranceClaim={(room) => setInsuranceRoomId(room.id)}
          />
        ) : (
          <div className={`grid items-start ${styles.roomGrid}`} data-room-overview-card-view>
            {visibleRooms.map((room) => (
              <RoomOverviewCard
                key={room.id}
                card={room}
                canUpdateOperationalStatus={canUpdateOperationalStatus}
                onInspectionActivate={canReadRoomNotes ? openInspection : undefined}
                canCreateInsuranceClaims={canCreateInsuranceClaims}
                canReadRoomAccessPassword={canReadRoomAccessPassword}
                canManageRoomAccessPassword={canManageRoomAccessPassword}
                onCreateInsuranceClaim={(room) => setInsuranceRoomId(room.id)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex min-h-80 items-center rounded-xl border bg-card">
          <EmptyState icon={BedDouble} title={i18n("auto.m0092")} description={i18n("auto.m0093")} />
        </div>
      )}

      <RoomInspectionDialog
        room={inspectionRoom}
        open={Boolean(inspectionRoom)}
        canComplete={canCompleteRoomNotes}
        refreshKey={inspectionRefreshKey}
        canCreate={canCreateRoomNotes}
        canUpdate={canUpdateRoomNotes}
        canDelete={canDeleteRoomNotes}
        onCreate={(room) => setComposerRoomId(room.id)}
        onOpenChange={(open) => { if (!open) closeInspection(); }}
        onPendingMemoCountChange={updatePendingMemoCount}
      />
      <RoomNoteComposerDialog room={composerRoom} open={Boolean(composerRoom)} onOpenChange={(open) => { if (!open) setComposerRoomId(null); }} onCreated={handleCreated} />
      <InsuranceClaimComposerDialog room={insuranceRoom} open={Boolean(insuranceRoom)} onOpenChange={(open) => { if (!open) setInsuranceRoomId(null); }} onCreated={(roomId) => { const room = allRooms.find((item) => item.id === roomId); updateInsuranceClaimCount(roomId, (room?.insuranceClaimCount ?? 0) + 1); }} />
    </div>
  );
}
