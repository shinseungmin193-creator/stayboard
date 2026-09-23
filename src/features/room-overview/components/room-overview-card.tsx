"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowUpRight, CalendarDays, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import { getReservationDisplayName } from "@/features/reservations/reservation-display";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import { cn } from "@/lib/utils";
import { getZonedDateInput } from "@/lib/zoned-date";
import { requiresRoomInspection, type RoomOverviewCard as RoomOverviewCardData } from "../domain/room-overview";
import { getRoomStatusThemeStatus, ROOM_INSPECTION_BORDER_CLASS, ROOM_STATUS_THEME } from "../room-overview-visuals";
import { RoomInspectionButton } from "./room-inspection-button";
import { RoomOverviewGuestInfo } from "./room-overview-guest-info";
import { RoomOverviewProviderBadges } from "./room-overview-provider-badges";
import { RoomOverviewStatusHeader } from "./room-overview-status-header";
import styles from "./room-overview-visuals.module.css";

const footerButtonClassName = "min-h-10 rounded-none px-1 text-xs xl:h-9 xl:min-h-9 xl:text-sm xl:[&_svg:not([class*='size-'])]:size-3.5";
type RoomSyncState = RoomOverviewCardData["syncStates"][number];

function isSyncAlert(sync: RoomSyncState): sync is RoomSyncState & { status: "FAILED" | "TIMEOUT" } {
  return sync.status === "FAILED" || sync.status === "TIMEOUT";
}

export function RoomOverviewCard({ card, canUpdateOperationalStatus = true, onInspectionActivate }: {
  card: RoomOverviewCardData;
  canUpdateOperationalStatus?: boolean;
  onInspectionActivate?: (room: RoomOverviewCardData) => void;
}) {
  const i18n = useTranslations();
  const syncLabel = { FAILED: i18n("sync.failed"), TIMEOUT: i18n("sync.delayed") } as const;
  const themeStatus = getRoomStatusThemeStatus(card);
  const theme = ROOM_STATUS_THEME[themeStatus];
  const reservation = card.currentReservation ?? card.nextReservation;
  const guestName = reservation ? getReservationDisplayName(reservation, "") || null : null;
  const currentProvider = card.currentReservation?.provider ?? null;
  const syncAlert = card.syncStates.filter(isSyncAlert).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const inspectionRequired = requiresRoomInspection(card);
  const hasCardAlerts = Boolean(syncAlert || card.activeConflictCount || inspectionRequired);
  const reservationsHref = `/reservations?roomId=${card.id}`;
  const currentHref = reservation ? `${reservationsHref}&from=${getZonedDateInput(reservation.startDate)}&to=${getZonedDateInput(reservation.endDate)}` : reservationsHref;

  return (
    <Card
      size="sm"
      className={cn(
        "relative gap-0 overflow-hidden py-0 shadow-sm ring-0 transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none",
        styles.roomCard,
        theme.bodyClass,
        inspectionRequired && themeStatus !== "CONFLICT" && ROOM_INSPECTION_BORDER_CLASS,
      )}
      data-room-status-theme={themeStatus}
      data-room-inspection-required={inspectionRequired ? "true" : undefined}
      aria-label={i18n("auto.m0474", { value0: card.propertyName, value1: formatRoomDisplayName(card) })}
    >
      <RoomOverviewStatusHeader
        roomId={card.id}
        roomLabel={card.name}
        reservationState={card.status}
        initialOperationalStatus={card.operationalStatus}
        nextReservationLeadDays={card.nextReservationLeadDays}
        canUpdate={canUpdateOperationalStatus}
      />

      <CardHeader className={cn("grid grid-cols-1 border-b border-border/70", styles.roomCardSection)}>
        <div className="min-w-0">
          <p data-room-overview-property className={cn("truncate font-medium leading-4 text-muted-foreground", styles.propertyName)}>{card.propertyName}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className={cn("min-w-0 flex-1 basis-20 truncate font-bold leading-6 tracking-tight", styles.roomName, theme.titleClass)}>{formatRoomDisplayName(card)}</h3>
            <RoomOverviewProviderBadges providers={card.providers} currentProvider={currentProvider} />
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("flex flex-1 flex-col gap-2.5", styles.roomCardSection)}>
        {reservation ? <RoomOverviewGuestInfo reservation={reservation} guestName={guestName} reservationCount={card.reservationCount} isNextReservation={!card.currentReservation} /> : null}
        {hasCardAlerts && <div className="flex flex-wrap items-center gap-1.5 border-t pt-1.5 text-[10px] text-muted-foreground xl:text-xs">
          {inspectionRequired && <RoomInspectionButton count={card.pendingMemoCount} onClick={onInspectionActivate ? () => onInspectionActivate(card) : undefined} />}
          {syncAlert && <span data-room-overview-sync-warning className="flex min-w-0 items-center gap-1 font-medium text-destructive"><Clock3 className="size-3 shrink-0 xl:size-3.5" /><span className="truncate">{getProviderLabel(syncAlert.provider, i18n)} {syncLabel[syncAlert.status]}</span></span>}
          {card.activeConflictCount > 0 && <span className="ml-auto flex shrink-0 items-center gap-1 font-medium text-destructive"><AlertTriangle className="size-3" />{i18n("conflict.count", { count: card.activeConflictCount })}</span>}
        </div>}
      </CardContent>

      <CardFooter data-room-overview-footer className={cn("grid grid-cols-3 gap-0 bg-transparent p-0", styles.actionBar)}>
        <Button nativeButton={false} render={<Link href={currentHref} />} variant="ghost" size="xs" className={footerButtonClassName}>{i18n("common.details")}<ArrowUpRight /></Button>
        <Button nativeButton={false} render={<Link href={reservationsHref} />} variant="ghost" size="xs" className={footerButtonClassName}>{i18n("auto.m0250")}</Button>
        <Button nativeButton={false} render={<Link href={`/room-status?propertyId=${card.propertyId}`} />} variant="ghost" size="xs" className={footerButtonClassName}><CalendarDays />{i18n("common.calendar")}</Button>
      </CardFooter>
    </Card>
  );
}
