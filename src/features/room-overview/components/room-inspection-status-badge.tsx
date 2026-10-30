"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RoomInspectionStatus } from "../domain/room-overview";

const INSPECTION_STATUS_STYLES = {
  INCOMPLETE: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
  READ: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  IN_PROGRESS: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  COMPLETED: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
} as const satisfies Record<Exclude<RoomInspectionStatus, "NONE">, string>;

export function RoomInspectionStatusBadge({ status, pendingCount, className, onClick }: {
  status: RoomInspectionStatus;
  pendingCount: number;
  className?: string;
  onClick?: () => void;
}) {
  const i18n = useTranslations();
  if (status === "NONE") return <span className="text-xs text-muted-foreground">-</span>;

  const countLabel = status !== "COMPLETED" && pendingCount > 0 ? `(${pendingCount})` : "";
  const label = `${i18n(`roomOverviewList.inspectionStates.${status}`)}${countLabel}`;
  const badge = (
    <Badge
      variant="outline"
      className={cn("h-6 px-2 text-[10px] font-semibold", INSPECTION_STATUS_STYLES[status], className)}
    >
      {label}
    </Badge>
  );

  if (!onClick) return badge;
  return (
    <button
      type="button"
      data-room-inspection-status
      aria-label={label}
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      onClick={onClick}
    >
      {badge}
    </button>
  );
}
