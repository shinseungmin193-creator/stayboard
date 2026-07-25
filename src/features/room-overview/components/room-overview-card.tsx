import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarDays, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { RoomOverviewCard as RoomOverviewCardData } from "../domain/room-overview";
import { cn } from "@/lib/utils";
import { RoomOverviewStatusHeader } from "./room-overview-status-header";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import { getRoomOverviewStatusStyle } from "../room-overview-visuals";
import styles from "./room-overview-visuals.module.css";
import { RoomOverviewGuestInfo } from "./room-overview-guest-info";
import { getReservationDisplayName } from "@/features/reservations/reservation-display";
import { RoomOverviewProviderBadges } from "./room-overview-provider-badges";
import { formatReservationConflictCount, RESERVATION_CONFLICT_UI } from "@/features/reservation-conflicts/reservation-conflict.labels";

const syncLabel = { RUNNING: "동기화 중", SUCCESS: "동기화 정상", FAILED: "동기화 실패", TIMEOUT: "동기화 지연" } as const;
const footerButtonClassName = "min-h-10 rounded-none px-1 text-xs xl:h-9 xl:min-h-9 xl:text-sm xl:[&_svg:not([class*='size-'])]:size-3.5";

export function RoomOverviewCard({ card, canUpdateOperationalStatus = true }: { card: RoomOverviewCardData; canUpdateOperationalStatus?: boolean }) {
  const reservation = card.currentReservation ?? card.nextReservation;
  const guestName = reservation ? getReservationDisplayName(reservation, "") || null : null;
  const currentProvider = card.currentReservation?.provider ?? null;
  const syncAlert = card.syncStates.filter((sync) => sync.status === "FAILED" || sync.status === "TIMEOUT").sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const reservationsHref = `/reservations?roomId=${card.id}`;
  const currentHref = reservation ? `${reservationsHref}&from=${reservation.startDate.toISOString().slice(0, 10)}&to=${reservation.endDate.toISOString().slice(0, 10)}` : reservationsHref;
  return (
    <Card
      size="sm"
      className={cn("relative gap-0 overflow-hidden py-0 ring-0", styles.roomCard)}
      style={getRoomOverviewStatusStyle(card.status)}
      aria-label={`${card.propertyName} ${formatRoomDisplayName(card)} 객실`}
    >
      <RoomOverviewStatusHeader
        roomId={card.id}
        roomLabel={card.name}
        reservationState={card.status}
        initialOperationalStatus={card.operationalStatus}
        nextReservationLeadDays={card.nextReservationLeadDays}
        canUpdate={canUpdateOperationalStatus}
      />
      <CardHeader className="grid grid-cols-1 border-b border-border/70 py-2.5">
        <div className="min-w-0">
          <p data-room-overview-property className="truncate text-xs font-medium leading-4 text-muted-foreground">
            {card.propertyName}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="min-w-0 flex-1 basis-20 truncate text-lg font-bold leading-6 tracking-tight text-foreground">
              {formatRoomDisplayName(card)}
            </h3>
            <RoomOverviewProviderBadges providers={card.providers} currentProvider={currentProvider} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 py-2.5">
        {reservation ? <RoomOverviewGuestInfo reservation={reservation} guestName={guestName} reservationCount={card.reservationCount} isNextReservation={!card.currentReservation} /> : null}
        <div className="flex items-center justify-between gap-2 border-t pt-1.5 text-[10px] text-muted-foreground xl:text-xs">
          <span data-room-overview-sync-warning={syncAlert ? true : undefined} className={cn("flex min-w-0 items-center gap-1", syncAlert && "font-medium text-foreground/80")}><Clock3 className={cn("size-3 shrink-0 xl:size-3.5", syncAlert && "text-destructive")} /><span className="truncate">{syncAlert ? `${syncAlert.provider} ${syncLabel[syncAlert.status]}` : card.latestSync ? syncLabel[card.latestSync.status] : "동기화 기록 없음"}</span></span>
          <span className={cn("flex shrink-0 items-center gap-1", card.activeConflictCount && "font-medium text-foreground/80")}>{card.activeConflictCount ? <><AlertTriangle className="size-3 text-destructive" />{formatReservationConflictCount(card.activeConflictCount)}</> : <span data-room-overview-no-conflict>{RESERVATION_CONFLICT_UI.noneLabel}</span>}</span>
        </div>
      </CardContent>
      <CardFooter data-room-overview-footer className={cn("grid grid-cols-3 gap-0 bg-muted/25 p-0", styles.actionBar)}>
        <Button nativeButton={false} render={<Link href={currentHref} />} variant="ghost" size="xs" className={footerButtonClassName}>상세 <ArrowUpRight /></Button>
        <Button nativeButton={false} render={<Link href={reservationsHref} />} variant="ghost" size="xs" className={footerButtonClassName}>예약 목록</Button>
        <Button nativeButton={false} render={<Link href={`/room-status?propertyId=${card.propertyId}`} />} variant="ghost" size="xs" className={footerButtonClassName}><CalendarDays />캘린더</Button>
      </CardFooter>
    </Card>
  );
}
