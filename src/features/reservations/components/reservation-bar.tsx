import { useTranslations } from "next-intl";import { AlertTriangle } from "lucide-react";
import type { ReservationStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getZonedDateInput } from "@/lib/zoned-date";
import { getProviderVisual, getReservationBarLabel, RESERVATION_CONFLICT_VISUAL } from "../provider-visuals";
import type { ReservationConflictPeer } from "@/features/reservation-conflicts/domain/reservation-conflict";

export interface ReservationBarProps {
  id: string;
  provider?: string | null;
  providerReservationId: string | null;
  roomName: string;
  guestName: string | null;
  startDate: Date;
  endDate: Date;
  status: ReservationStatus;
  activeConflicts: ReservationConflictPeer[];
  left: number;
  top: number;
  width: number;
}

export function ReservationBar(props: ReservationBarProps) {const i18n = useTranslations();
  const visual = getProviderVisual(props.provider);
  const label = getReservationBarLabel(props.provider, props.width, i18n);
  const hasActiveConflict = props.activeConflicts.length > 0;
  const startDate = getZonedDateInput(props.startDate, DEFAULT_TIMEZONE);
  const endDate = getZonedDateInput(props.endDate, DEFAULT_TIMEZONE);
  const conflictDetails = props.activeConflicts.map((peer) => {
    const peerVisual = getProviderVisual(peer.provider);
    return `${peerVisual.label} ${getZonedDateInput(peer.startDate, DEFAULT_TIMEZONE)}–${getZonedDateInput(peer.endDate, DEFAULT_TIMEZONE)}`;
  });
  const details = [
  `Provider: ${visual.label}`, i18n("auto.m0393", { value0:
    props.roomName }), i18n("auto.m0394", { value0: startDate }), i18n("auto.m0395", { value0: endDate }), i18n("auto.m0396", { value0:
    props.guestName?.trim() || i18n("auto.m0397") }), i18n("auto.m0398", { value0:
    props.status }), i18n("auto.m0399", { value0:
    props.providerReservationId || i18n("auto.m0400") }), ...(hasActiveConflict ? ["", i18n("conflict.label"), i18n("conflict.overlapDescription"), ...conflictDetails] : [])].
  join("\n");

  return (
    <div
      className={cn("absolute z-10 flex h-7 items-center gap-1 overflow-hidden rounded-md border px-2 text-[11px] font-semibold shadow-sm", visual.className, hasActiveConflict && RESERVATION_CONFLICT_VISUAL)}
      style={{ left: props.left, top: props.top, width: props.width }}
      title={details}
      aria-label={i18n("auto.m0401", { value0: label, value1: props.roomName, value2: startDate, value3: endDate, value4: hasActiveConflict ? `, ${i18n("conflict.label")}` : "" })}
      data-provider={props.provider ?? "OTHER"}
      data-conflict={hasActiveConflict || undefined}>
      
      {hasActiveConflict && <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </div>);

}
