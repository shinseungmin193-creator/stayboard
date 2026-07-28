"use client";import { useTranslations, useLocale } from "next-intl";

import Link from "next/link";
import { CalendarDays, Ellipsis, Eye, ListChecks, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { RoomCalendarSummary } from "../types/room-calendar-summary";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import { RoomCalendarStatusBadge } from "./room-calendar-status-badge";
import { RoomCalendarSync } from "./room-calendar-sync";




function Providers({ room }: {room: RoomCalendarSummary;}) {const i18n = useTranslations();
  const providers = [...new Set(room.sources.map((source) => source.provider))];
  if (!providers.length) return <span className="text-xs text-muted-foreground">{i18n("auto.m0248")}</span>;
  return <div className="flex flex-wrap gap-1">{providers.map((provider) => <Badge key={provider} variant="outline">{getProviderLabel(provider, i18n)}</Badge>)}</div>;
}

function FailureSummary({ room }: {room: RoomCalendarSummary;}) {const i18n = useTranslations();
  if (!room.failureSummaries.length) return null;
  const text = room.failureSummaries.map((item) => `${getProviderLabel(item.provider, i18n)}: ${item.message}`).join(" · ");
  return <button type="button" onClick={() => onOpenFailureSummary(text)} title={text} className="mt-1 max-w-64 truncate text-left text-xs text-destructive underline-offset-2 hover:underline">{text}</button>;
}

const failureText = (room: RoomCalendarSummary, translate: Parameters<typeof getProviderLabel>[1]) => room.failureSummaries.map((item) => `${getProviderLabel(item.provider, translate)}: ${item.message}`).join(" · ") || undefined;

function onOpenFailureSummary(message: string) {if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) window.alert(message);}

function MoreMenu({ room }: {room: RoomCalendarSummary;}) {const i18n = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={i18n("auto.m0249", { value0: room.roomName })} />}><Ellipsis /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem render={<Link href={`/reservations?roomId=${room.roomId}`} />}><ListChecks />{i18n("auto.m0250")}</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/calendar?roomId=${room.roomId}`} />}><CalendarDays />{i18n("auto.m0251")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);

}

export function RoomCalendarRow({ room, onOpen, mobile = false }: {room: RoomCalendarSummary;onOpen: (roomId: string) => void;mobile?: boolean;}) {const locale = useLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const formatter = new Intl.DateTimeFormat(localeTag, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" });const i18n = useTranslations();const formatDate = (value: Date | null) => value ? formatter.format(value) : i18n("auto.m0465");
  const detailButton = <Button type="button" size="sm" variant="outline" onClick={() => onOpen(room.roomId)} aria-label={i18n("auto.m0252", { value0: room.propertyName, value1: room.roomName })}><Eye />{i18n("auto.m0253")}</Button>;
  if (mobile) return (
    <Card size="sm" data-room-id={room.roomId}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium text-muted-foreground">{room.propertyName}</p><p className="truncate font-semibold">{room.roomName}</p></div><div><RoomCalendarStatusBadge status={room.status} summary={failureText(room, i18n)} /><FailureSummary room={room} /></div></div>
        <Providers room={room} />
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
          <div><span className="text-muted-foreground">{i18n("auto.m0006")}</span><p className="font-medium tabular-nums">{i18n("auto.m0210")}{room.activeSourceCount} / {room.sources.length}</p></div>
          <div><span className="text-muted-foreground">{i18n("common.reservation")}</span><p className="font-medium tabular-nums">{room.reservationCount}</p></div>
          <div><span className="text-muted-foreground">{i18n("conflict.label")}</span><p className={room.conflictCount ? "font-medium text-amber-700 dark:text-amber-300" : "font-medium"}>{room.conflictCount}</p></div>
          <div><span className="text-muted-foreground">{i18n("auto.m0213")}</span><p className="font-medium">{formatDate(room.lastSyncedAt)}</p></div>
        </div>
        <div className="flex flex-wrap items-start gap-2">{detailButton}<RoomCalendarSync roomIds={[room.roomId]} compact /><MoreMenu room={room} /></div>
      </CardContent>
    </Card>);


  return (
    <TableRow data-room-id={room.roomId}>
      <TableCell><p className="font-medium">{room.propertyName}</p><p className="text-xs text-muted-foreground">{room.roomName}</p></TableCell>
      <TableCell className="max-w-56 whitespace-normal"><Providers room={room} /></TableCell>
      <TableCell className="tabular-nums">{i18n("auto.m0210")}{room.activeSourceCount} / {room.sources.length}</TableCell>
      <TableCell className="text-center tabular-nums">{room.reservationCount}</TableCell>
      <TableCell className="text-center tabular-nums">{room.conflictCount ? <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300"><TriangleAlert className="size-3.5" />{room.conflictCount}</span> : "0"}</TableCell>
      <TableCell className="text-xs">{formatDate(room.lastSyncedAt)}</TableCell>
      <TableCell><RoomCalendarStatusBadge status={room.status} summary={failureText(room, i18n)} /><FailureSummary room={room} /></TableCell>
      <TableCell><div className="flex items-start justify-end gap-1.5">{detailButton}<RoomCalendarSync roomIds={[room.roomId]} compact /><MoreMenu room={room} /></div></TableCell>
    </TableRow>);

}
