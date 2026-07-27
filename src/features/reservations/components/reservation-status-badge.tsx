import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReservationDisplayStatus } from "../reservation-display-status";
import { getReservationStatusLabel, getReservationStatusVariant } from "../reservation-status-meta";

export function ReservationStatusBadge({ status, className }: { status: ReservationDisplayStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-5 px-2 text-[11px] font-semibold", getReservationStatusVariant(status), className)}>
      {getReservationStatusLabel(status)}
    </Badge>
  );
}
