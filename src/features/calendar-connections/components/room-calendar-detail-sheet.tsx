"use client";import { useLocale, useTranslations } from "next-intl";

import { Cable } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CalendarRoomOption } from "@/features/calendar-sources";
import { CalendarSourceForm } from "@/features/calendar-sources/components/calendar-source-form";
import type { RoomCalendarSummary } from "../types/room-calendar-summary";
import { CalendarSourceCard } from "./calendar-source-card";
import { RoomCalendarStatusBadge } from "./room-calendar-status-badge";
import { RoomCalendarSync } from "./room-calendar-sync";

export function RoomCalendarDetailSheet({ room, rooms, open, onOpenChange }: {room: RoomCalendarSummary | null;rooms: CalendarRoomOption[];open: boolean;onOpenChange: (open: boolean) => void;}) {const locale = useLocale();const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" });const formatDate = (value: Date | null) => value ? formatter.format(new Date(value)) : "-";const i18n = useTranslations();
  const selectedRoomOptions = room ? rooms.filter((option) => option.id === room.roomId) : [];
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="gap-0" style={{ width: "100%", maxWidth: "64rem" }}>{room && <>
    <SheetHeader className="border-b pr-12"><div className="flex flex-wrap items-center gap-2"><SheetTitle>{room.propertyName} · {room.roomName}</SheetTitle><RoomCalendarStatusBadge status={room.status} /></div><SheetDescription>{i18n("auto.m0226")}</SheetDescription><div className="flex flex-wrap items-start gap-2 pt-3"><RoomCalendarSync roomIds={[room.roomId]} compact /><CalendarSourceForm rooms={selectedRoomOptions} /></div></SheetHeader>
    <Tabs defaultValue="current" className="min-h-0 flex-1 p-4"><TabsList className="w-full"><TabsTrigger value="current">{i18n("auto.m0227")}</TabsTrigger><TabsTrigger value="history">{i18n("auto.m0228")}</TabsTrigger><TabsTrigger value="sources">{i18n("auto.m0229")}</TabsTrigger></TabsList>
      <TabsContent value="current" className="mt-4 space-y-3 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><div>{i18n("auto.m0230")}<strong className="tabular-nums">{room.latestRun?.targetCount ?? 0}</strong></div><div>{i18n("auto.m0206")}<strong className="tabular-nums text-emerald-700">{room.latestRun?.successCount ?? 0}</strong></div><div>{i18n("auto.m0208")}<strong className="tabular-nums text-destructive">{room.latestRun?.failedCount ?? 0}</strong></div></div>
        {room.sources.length ? room.sources.map((source) => <CalendarSourceCard key={source.id} source={source} rooms={rooms} showActions={false} />) : <EmptyState icon={Cable} title={i18n("auto.m0231")} description={i18n("auto.m0232")} />}
      </TabsContent>
      <TabsContent value="history" className="mt-4 overflow-auto"><Table><TableHeader><TableRow><TableHead>{i18n("auto.m0004")}</TableHead><TableHead>{i18n("auto.m0233")}</TableHead><TableHead>{i18n("auto.m0234")}</TableHead><TableHead>{i18n("auto.m0235")}</TableHead><TableHead>{i18n("common.status")}</TableHead><TableHead>{i18n("auto.m0236")}</TableHead><TableHead>{i18n("auto.m0237")}</TableHead></TableRow></TableHeader><TableBody>{room.history.map((run) => <TableRow key={run.id}><TableCell className="whitespace-nowrap text-xs">{formatDate(run.startedAt)}</TableCell><TableCell className="whitespace-nowrap text-xs">{formatDate(run.finishedAt)}</TableCell><TableCell>{run.executionMode === "AUTO" ? i18n("auto.m0238") : i18n("auto.m0239")}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{run.targetCount} / {run.successCount} / {run.failedCount}</TableCell><TableCell><RoomCalendarStatusBadge status={run.status} /></TableCell><TableCell>{run.actorName}</TableCell><TableCell className="max-w-64 text-xs text-destructive">{run.errorSummary ?? "-"}</TableCell></TableRow>)}</TableBody></Table>{!room.history.length && <p className="p-8 text-center text-sm text-muted-foreground">{i18n("auto.m0240")}</p>}</TabsContent>
      <TabsContent value="sources" className="mt-4 space-y-3 overflow-y-auto">{room.sources.length ? room.sources.map((source) => <CalendarSourceCard key={source.id} source={source} rooms={rooms} />) : <EmptyState icon={Cable} title={i18n("auto.m0231")} description={i18n("auto.m0232")} />}</TabsContent>
    </Tabs>
  </>}</SheetContent></Sheet>;
}
