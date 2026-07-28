"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getRoomCalendarStatusLabel, ROOM_CALENDAR_STATUS_META, type RoomCalendarStatus } from "../types/room-calendar-summary";
import { AlertTriangle, CheckCircle2, CircleOff, Clock3, RefreshCcw, XCircle } from "lucide-react";

export function RoomCalendarStatusBadge({ status, className, summary }: { status: RoomCalendarStatus; className?: string; summary?: string }) {
  const t = useTranslations();
  const meta = ROOM_CALENDAR_STATUS_META[status];
  const label = getRoomCalendarStatusLabel(status, t);
  const Icon = meta.icon === "check" ? CheckCircle2 : meta.icon === "warning" ? AlertTriangle : meta.icon === "error" ? XCircle : meta.icon === "loading" ? RefreshCcw : meta.icon === "off" ? CircleOff : Clock3;
  const badge = <Badge variant="outline" className={cn("gap-1", meta.className, className)}><Icon className={cn("size-3.5", meta.icon === "loading" && "animate-spin")} />{label}</Badge>;
  if (!summary) return badge;
  return <button type="button" title={summary} aria-label={`${label}: ${summary}`} onClick={() => { if (window.matchMedia("(max-width: 1023px)").matches) window.alert(summary); }} className="cursor-help text-left">{badge}</button>;
}
