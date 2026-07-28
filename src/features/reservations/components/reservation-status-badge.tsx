import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ReservationDisplayStatus } from "../reservation-display-status";
import { getLocalizedReservationStatusLabel, getReservationStatusVariant } from "../reservation-status-meta";

export function ReservationStatusBadge({ status, className }: { status: ReservationDisplayStatus; className?: string }) {
  const t = useTranslations();
  return (
    <Badge variant="outline" className={cn("h-5 px-2 text-[11px] font-semibold", getReservationStatusVariant(status), className)}>
      {getLocalizedReservationStatusLabel(status, t)}
    </Badge>
  );
}
