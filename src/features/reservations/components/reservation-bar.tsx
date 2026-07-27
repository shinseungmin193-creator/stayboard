import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { ReservationStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { RESERVATION_CONFLICT_UI } from "@/features/reservation-conflicts/reservation-conflict.labels";
import { getProviderVisual, getReservationBarLabel, RESERVATION_CONFLICT_VISUAL } from "../provider-visuals";

export interface ReservationBarProps {
  id: string;
  provider?: string | null;
  providerReservationId: string | null;
  roomName: string;
  guestName: string | null;
  startDate: Date;
  endDate: Date;
  status: ReservationStatus;
  hasActiveConflict: boolean;
  left: number;
  top: number;
  width: number;
}

export function ReservationBar(props: ReservationBarProps) {
  const visual = getProviderVisual(props.provider);
  const label = getReservationBarLabel(props.provider, props.width);
  const details = [
    `Provider: ${visual.label}`,
    `객실명: ${props.roomName}`,
    `체크인: ${format(props.startDate, "yyyy-MM-dd")}`,
    `체크아웃: ${format(props.endDate, "yyyy-MM-dd")}`,
    `투숙객명: ${props.guestName?.trim() || "예약자 정보 없음"}`,
    `예약 상태: ${props.status}`,
    `예약 ID: ${props.providerReservationId || "정보 없음"}`,
  ].join("\n");

  return (
    <div
      className={cn("absolute z-10 flex h-7 items-center gap-1 overflow-hidden rounded-md border px-2 text-[11px] font-semibold shadow-sm", visual.className, props.hasActiveConflict && RESERVATION_CONFLICT_VISUAL)}
      style={{ left: props.left, top: props.top, width: props.width }}
      title={details}
      aria-label={`${label}, ${props.roomName}, ${format(props.startDate, "yyyy-MM-dd")}부터 ${format(props.endDate, "yyyy-MM-dd")}까지${props.hasActiveConflict ? `, ${RESERVATION_CONFLICT_UI.label}` : ""}`}
      data-provider={props.provider ?? "OTHER"}
      data-conflict={props.hasActiveConflict || undefined}
    >
      {props.hasActiveConflict && <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </div>
  );
}
