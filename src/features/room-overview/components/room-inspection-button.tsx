"use client";

import { useTranslations } from "next-intl";
import { Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROOM_STATUS_THEME } from "../room-overview-visuals";

export function RoomInspectionButton({ count, onClick, className, badgeClassName }: {
  count: number;
  onClick?: () => void;
  className?: string;
  badgeClassName?: string;
}) {
  const i18n = useTranslations();
  const label = `${i18n("roomStatus.INSPECTION_REQUIRED")} ${count}`;
  const badge = <Badge variant="outline" className={cn("h-6 gap-1 px-2 text-[10px] xl:text-xs", ROOM_STATUS_THEME.INSPECTION_REQUIRED.badgeClass, badgeClassName)}><Wrench className="size-3.5" />{label}</Badge>;

  if (!onClick) return <span aria-label={label} className={className}>{badge}</span>;
  return <button type="button" data-room-inspection-trigger aria-label={label} className={cn("rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1", className)} onClick={onClick}>{badge}</button>;
}
