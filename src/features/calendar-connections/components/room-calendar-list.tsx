"use client";import { useTranslations } from "next-intl";

import { useEffect, useMemo, useState } from "react";
import { Cable } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CalendarRoomOption } from "@/features/calendar-sources";
import type { RoomCalendarSummary } from "../types/room-calendar-summary";
import { RoomCalendarDetailSheet } from "./room-calendar-detail-sheet";
import { RoomCalendarRow } from "./room-calendar-row";

export function RoomCalendarList({ summaries, rooms, canManage }: {summaries: RoomCalendarSummary[];rooms: CalendarRoomOption[];canManage: boolean;}) {const i18n = useTranslations();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [deletedSourceIds, setDeletedSourceIds] = useState<ReadonlySet<string>>(() => new Set());
  const [notification, setNotification] = useState<{ message: string; warning: boolean } | null>(null);
  const selectedRoom = useMemo(() => {
    const room = summaries.find((item) => item.roomId === selectedRoomId) ?? null;
    return room ? { ...room, sources: room.sources.filter((source) => !deletedSourceIds.has(source.id)) } : null;
  }, [deletedSourceIds, selectedRoomId, summaries]);
  const handleOpen = (roomId: string) => setSelectedRoomId(roomId);
  const handleOpenChange = (open: boolean) => {if (!open) setSelectedRoomId(null);};
  const handleSourceDeleted = (calendarSourceId: string, message: string) => {
    setDeletedSourceIds((current) => new Set(current).add(calendarSourceId));
    setNotification({ message, warning: false });
  };
  const handleSourceUpdated = (message: string, warning = false) => setNotification({ message, warning });
  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  if (!summaries.length) return <Card><CardContent className="flex min-h-72 items-center"><EmptyState icon={Cable} title={i18n("auto.m0245")} description={i18n("auto.m0246")} /></CardContent></Card>;

  return <>
    <div className="grid gap-3 lg:hidden">{summaries.map((room) => <RoomCalendarRow key={room.roomId} room={room} onOpen={handleOpen} mobile />)}</div>
    <Card className="hidden py-0 lg:block">
      <Table>
        <TableHeader><TableRow><TableHead>{i18n("auto.m0005")}</TableHead><TableHead>{i18n("technical.provider")}</TableHead><TableHead>{i18n("auto.m0006")}</TableHead><TableHead className="text-center">{i18n("common.reservation")}</TableHead><TableHead className="text-center">{i18n("conflict.label")}</TableHead><TableHead>{i18n("auto.m0213")}</TableHead><TableHead>{i18n("auto.m0243")}</TableHead><TableHead className="text-right">{i18n("navigation.groups.management")}</TableHead></TableRow></TableHeader>
        <TableBody>{summaries.map((room) => <RoomCalendarRow key={room.roomId} room={room} onOpen={handleOpen} />)}</TableBody>
      </Table>
    </Card>
    <RoomCalendarDetailSheet room={selectedRoom} rooms={rooms} open={Boolean(selectedRoom)} onOpenChange={handleOpenChange} canManage={canManage} onSourceDeleted={handleSourceDeleted} onSourceUpdated={handleSourceUpdated} />
    {notification && <div role="status" aria-live="polite" className={`fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[70] max-w-sm rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg ${notification.warning ? "border-amber-500/40 text-amber-800 dark:text-amber-300" : "border-emerald-500/30 text-popover-foreground"}`}>{notification.message}</div>}
  </>;
}
