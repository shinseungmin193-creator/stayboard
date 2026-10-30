"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  ShieldPlus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getReservationNightCount } from "@/features/reservations/reservation-date";
import { cn } from "@/lib/utils";
import {
  groupRoomOverviewByProperty,
  requiresRoomInspection,
  type RoomOverviewCard,
} from "../domain/room-overview";
import { useCollapsedRoomGroups } from "../hooks/use-collapsed-room-groups";
import { getMobileSyncLabel } from "../room-overview-mobile-visuals";
import { ROOM_STATUS_THEME } from "../room-overview-visuals";
import { RoomInspectionButton } from "./room-inspection-button";
import { RoomInspectionStatusBadge } from "./room-inspection-status-badge";

const COLUMN_COUNT = 10;

function RoomStatusBadge({ room }: { room: RoomOverviewCard }) {
  const i18n = useTranslations();
  const theme = ROOM_STATUS_THEME[room.status];
  const Icon = theme.icon;
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 px-2 text-[11px] font-semibold", theme.badgeClass)}>
      <Icon className="size-3" aria-hidden="true" />
      {i18n(theme.labelKey)}
    </Badge>
  );
}

function GroupMetric({ status, count }: { status: keyof typeof ROOM_STATUS_THEME; count: number }) {
  const i18n = useTranslations();
  if (!count) return null;
  const theme = ROOM_STATUS_THEME[status];
  return (
    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", theme.badgeClass)}>
      {i18n(theme.labelKey)} {count}
    </Badge>
  );
}

function RoomOverviewRow({
  room,
  canReadRoomNotes,
  canCreateRoomNotes,
  onInspectionActivate,
  onCreateRoomNote,
  canCreateInsuranceClaims,
  onCreateInsuranceClaim,
}: {
  room: RoomOverviewCard;
  canReadRoomNotes: boolean;
  canCreateRoomNotes: boolean;
  onInspectionActivate: (room: RoomOverviewCard) => void;
  onCreateRoomNote: (room: RoomOverviewCard) => void;
  canCreateInsuranceClaims: boolean;
  onCreateInsuranceClaim: (room: RoomOverviewCard) => void;
}) {
  const locale = useLocale();
  const i18n = useTranslations();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const dateFormatter = new Intl.DateTimeFormat(localeTag, {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const syncFormatter = new Intl.DateTimeFormat(localeTag, {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const current = room.currentReservation;
  const next = room.nextReservation;
  const nights = current ? getReservationNightCount(current) : 0;
  const sync = getMobileSyncLabel(room, i18n);
  const latestSyncAt = room.latestSync?.completedAt ?? room.latestSync?.startedAt ?? null;
  const inspectionRequired = requiresRoomInspection(room);
  const syncDotClass = sync.error
    ? "bg-destructive"
    : room.latestSync?.status === "RUNNING"
      ? "bg-amber-500"
      : room.latestSync?.status === "SUCCESS"
        ? "bg-emerald-500"
        : "bg-muted-foreground/40";

  return (
    <tr
      className="h-11 border-b bg-card transition-colors hover:bg-muted/35"
      data-room-id={room.id}
      data-room-status={room.status}
      data-room-inspection-required={inspectionRequired ? "true" : undefined}
    >
      <td className="px-3 py-1.5 font-bold">{room.name}</td>
      <td className="px-2 py-1.5"><RoomStatusBadge room={room} /></td>
      <td className="px-2 py-1.5 text-xs tabular-nums">{current ? dateFormatter.format(current.startDate) : "-"}</td>
      <td className="px-2 py-1.5 text-xs tabular-nums">{current ? dateFormatter.format(current.endDate) : "-"}</td>
      <td className="px-2 py-1.5 text-center text-xs tabular-nums">{nights > 0 ? i18n("roomOverviewList.nights", { count: nights }) : "-"}</td>
      <td className="px-2 py-1.5 text-xs">
        {next ? <span className="block leading-4"><strong className="font-semibold">{dateFormatter.format(next.startDate)}</strong><span className="block text-[10px] text-blue-600 dark:text-blue-400">{room.nextReservationLeadDays === 0 ? i18n("roomOverviewList.today") : i18n("roomOverviewList.daysLater", { count: room.nextReservationLeadDays ?? 0 })}</span></span> : <span className="text-muted-foreground">{i18n("reservation.none")}</span>}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          {inspectionRequired
            ? <RoomInspectionButton count={room.pendingMemoCount} onClick={canReadRoomNotes ? () => onInspectionActivate(room) : undefined} badgeClassName="h-6 px-2 text-[10px]" />
            : !canCreateRoomNotes && <span className="text-xs text-muted-foreground">-</span>}
          {canCreateRoomNotes && <Button type="button" variant="outline" size="xs" className="h-6 gap-1 px-2 text-[10px]" onClick={() => onCreateRoomNote(room)}><Plus className="size-3" />{i18n("roomOverviewList.registerInspection")}</Button>}
        </div>
      </td>
      <td className="px-2 py-1.5 text-center"><RoomInspectionStatusBadge status={room.inspectionStatus} pendingCount={room.pendingMemoCount} /></td>
      <td className="px-2 py-1.5 text-center">
        {canCreateInsuranceClaims ? <Button type="button" variant="outline" size="xs" className="h-6 gap-1 px-2 text-[10px]" onClick={() => onCreateInsuranceClaim(room)}><ShieldPlus className="size-3" />{room.insuranceClaimCount > 0 ? `보고 ${room.insuranceClaimCount}` : "보고"}</Button> : <span className="text-xs text-muted-foreground">-</span>}
      </td>
      <td className="px-2 py-1.5 text-xs" title={sync.label}>
        <span className={cn("mr-1.5 inline-block size-2 rounded-full", syncDotClass)} aria-hidden="true" />
        <span className={cn("tabular-nums", sync.error && "text-destructive")}>{latestSyncAt ? syncFormatter.format(latestSyncAt) : sync.label}</span>
      </td>
    </tr>
  );
}

export function RoomOverviewListView({
  rooms,
  canReadRoomNotes,
  canCreateRoomNotes,
  onInspectionActivate,
  onCreateRoomNote,
  canCreateInsuranceClaims,
  onCreateInsuranceClaim,
}: {
  rooms: RoomOverviewCard[];
  canReadRoomNotes: boolean;
  canCreateRoomNotes: boolean;
  onInspectionActivate: (room: RoomOverviewCard) => void;
  onCreateRoomNote: (room: RoomOverviewCard) => void;
  canCreateInsuranceClaims: boolean;
  onCreateInsuranceClaim: (room: RoomOverviewCard) => void;
}) {
  const i18n = useTranslations();
  const groups = groupRoomOverviewByProperty(rooms);
  const { collapsedIds, toggleGroup } = useCollapsedRoomGroups();

  return (
    <div className="relative overflow-x-auto rounded-xl border bg-card shadow-sm" data-room-overview-list>
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background/95 shadow-[0_1px_0_var(--border)] backdrop-blur">
          <tr className="h-10 text-left text-[11px] text-muted-foreground">
            <th className="w-28 px-3 font-semibold">{i18n("common.room")}</th>
            <th className="w-32 px-2 font-semibold">{i18n("common.status")}</th>
            <th className="w-24 px-2 font-semibold">{i18n("reservation.checkIn")}</th>
            <th className="w-24 px-2 font-semibold">{i18n("reservation.checkOut")}</th>
            <th className="w-16 px-2 text-center font-semibold">{i18n("roomOverviewList.stay")}</th>
            <th className="w-28 px-2 font-semibold">{i18n("roomOverviewList.nextReservation")}</th>
            <th className="w-44 px-2 font-semibold">{i18n("roomOverviewList.inspection")}</th>
            <th className="w-20 px-2 text-center font-semibold">{i18n("roomOverviewList.inspectionStatus")}</th>
            <th className="w-24 px-2 text-center font-semibold">보험/보상</th>
            <th className="w-32 px-2 font-semibold">{i18n("roomOverviewList.lastSync")}</th>
          </tr>
        </thead>
        {groups.map((group) => {
          const collapsed = collapsedIds.has(group.id);
          return (
            <tbody key={group.id} data-property-id={group.id}>
              <tr className="border-y bg-muted/55">
                <td colSpan={COLUMN_COUNT} className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!collapsed}
                    className="flex min-h-10 w-full items-center gap-2 px-3 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                    <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
                    <strong className="text-sm">{group.name}</strong>
                    <span className="text-xs text-muted-foreground">{i18n("roomOverviewList.roomCount", { count: group.rooms.length })}</span>
                    <span className="ml-2 flex flex-wrap gap-1">
                      <GroupMetric status="CHECK_IN_TODAY" count={group.summary.statuses.CHECK_IN_TODAY} />
                      <GroupMetric status="CHECK_OUT_TODAY" count={group.summary.statuses.CHECK_OUT_TODAY} />
                      <GroupMetric status="OCCUPIED" count={group.summary.statuses.OCCUPIED} />
                      <GroupMetric status="VACANT" count={group.summary.statuses.VACANT} />
                      <GroupMetric status="CONFLICT" count={group.summary.statuses.CONFLICT} />
                      <GroupMetric status="INSPECTION_REQUIRED" count={group.summary.operationalStatuses.INSPECTION_REQUIRED} />
                    </span>
                  </button>
                </td>
              </tr>
              {!collapsed && group.rooms.map((room) => (
                <RoomOverviewRow
                  key={room.id}
                  room={room}
                  canReadRoomNotes={canReadRoomNotes}
                  canCreateRoomNotes={canCreateRoomNotes}
                  onInspectionActivate={onInspectionActivate}
                  onCreateRoomNote={onCreateRoomNote}
                  canCreateInsuranceClaims={canCreateInsuranceClaims}
                  onCreateInsuranceClaim={onCreateInsuranceClaim}
                />
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
