"use client";
import { useState, useTransition } from "react";
import { Check, ChevronDown, LoaderCircle, Lock } from "lucide-react";
import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateRoomOperationalStatusAction } from "@/features/rooms/room-operational-status.actions";
import { ROOM_OPERATIONAL_STATUS_META, ROOM_OPERATIONAL_STATUS_VALUES } from "@/features/rooms/room-operational-status";
import { cn } from "@/lib/utils";
import { ROOM_OVERVIEW_STATUS_META, type RoomReservationState } from "../domain/room-overview";
import styles from "./room-overview-visuals.module.css";

type RoomOverviewStatusHeaderProps = {
  roomId: string;
  roomLabel: string;
  reservationState: RoomReservationState;
  initialOperationalStatus: RoomOperationalStatus;
  nextReservationLeadDays: number | null;
  canUpdate: boolean;
};

export function RoomOverviewStatusHeader({
  roomId,
  roomLabel,
  reservationState,
  initialOperationalStatus,
  nextReservationLeadDays,
  canUpdate,
}: RoomOverviewStatusHeaderProps) {
  const [operationalStatus, setOperationalStatus] = useState(initialOperationalStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reservationMeta = ROOM_OVERVIEW_STATUS_META[reservationState];
  const operationalMeta = ROOM_OPERATIONAL_STATUS_META[operationalStatus];
  const assistiveLabel = nextReservationLeadDays === null
    ? "예약 없음"
    : nextReservationLeadDays === 0
      ? "다음 예약 오늘"
      : `다음 예약 ${nextReservationLeadDays}일 후`;

  const update = (nextStatus: RoomOperationalStatus) => {
    if (pending || nextStatus === operationalStatus) return;

    setError(null);
    startTransition(async () => {
      const result = await updateRoomOperationalStatusAction({
        roomId,
        operationalStatus: nextStatus,
      });

      if (result.success) {
        setOperationalStatus(result.operationalStatus);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 px-3 text-left text-sm font-semibold outline-none transition-opacity hover:brightness-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          styles.statusHeader,
        )}
        aria-label={`${roomLabel} ${reservationMeta.label} · ${canUpdate ? "운영 상태 변경" : "로그인 후 변경 가능"}`}
        disabled={!canUpdate}
        onClick={(event) => event.stopPropagation()}
      >
        <span>{reservationMeta.label}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {operationalStatus === "NONE" ? (
            <span data-room-overview-next-reservation className="truncate text-[10px] font-medium opacity-70 xl:text-xs">
              {assistiveLabel}
            </span>
          ) : (
            <Badge
              variant="outline"
              className={cn("h-5 px-1.5 text-[9px] xl:rounded-md xl:text-[10px]", operationalMeta.badgeClassName)}
            >
              {operationalMeta.label}
            </Badge>
          )}
          {!canUpdate ? <Lock className="size-3 xl:size-3.5" /> : pending ? (
            <LoaderCircle className="size-3 animate-spin xl:size-3.5" />
          ) : (
            <ChevronDown className="size-3 xl:size-3.5" />
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>운영 상태 변경</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROOM_OPERATIONAL_STATUS_VALUES.map((status) => (
            <DropdownMenuItem
              key={status}
              disabled={pending}
              onClick={() => update(status)}
            >
              {ROOM_OPERATIONAL_STATUS_META[status].label}
              {operationalStatus === status && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {error && (
          <>
            <DropdownMenuSeparator />
            <p role="alert" className="px-2 py-1 text-xs text-destructive">
              {error}
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
