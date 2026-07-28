import { useLocale, useTranslations } from "next-intl";import { AlertTriangle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReservationDisplayName } from "@/features/reservations/reservation-display";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { RoomOperationalSchedule, RoomOperationalScheduleReservation } from "../domain/room-overview";
import { getProviderLabel } from "@/features/reservations/provider-visuals";

type ScheduleReservation = RoomOperationalScheduleReservation;
interface ScheduleConflict {id: string;overlapStart: Date;overlapEnd: Date;room: {id: string;name: string;};}


function EventRow({ item, date }: {item: ScheduleReservation;date: Date;}) {const locale = useLocale();const dateFormatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" });const i18n = useTranslations();
  const providerLabel = getProviderLabel(item.provider, i18n);
  return <li className="rounded-md border bg-background/65 p-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{formatRoomDisplayName({ name: item.roomName })}</p><p className="truncate text-[10px] text-muted-foreground">{getReservationDisplayName(item, i18n("common.reservation"))}</p></div>{providerLabel && <Badge variant="outline" className="px-1.5 text-[9px]">{providerLabel}</Badge>}</div><p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">{item.hasConflict && <AlertTriangle className="size-3 text-destructive" />}{dateFormatter.format(date)} · {dateFormatter.format(item.startDate)} → {dateFormatter.format(item.endDate)}</p></li>;
}

function EventGroup({ title, items, dateKey }: {title: string;items: ScheduleReservation[];dateKey: "startDate" | "endDate";}) {const i18n = useTranslations();
  return <section><div className="mb-1.5 flex items-center justify-between"><h3 className="text-xs font-semibold">{title}</h3><span className="text-[10px] text-muted-foreground">{items.length}{i18n("auto.m0013")}</span></div>{items.length ? <ul className="space-y-1.5">{items.slice(0, 8).map((item) => <EventRow key={`${title}-${item.id}`} item={item} date={item[dateKey]} />)}</ul> : <p className="rounded-md border border-dashed p-2 text-center text-[10px] text-muted-foreground">{i18n("auto.m0478")}</p>}</section>;
}

export function RoomOverviewSchedule({ schedule, conflicts }: {schedule: RoomOperationalSchedule<ScheduleReservation>;conflicts: ScheduleConflict[];}) {const locale = useLocale();const dateFormatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" });const i18n = useTranslations();
  return <Card className="sticky top-18 max-h-[calc(100dvh-5rem)] gap-0 overflow-y-auto py-0"><CardHeader className="sticky top-0 z-10 border-b bg-card/95 py-3 backdrop-blur"><CardTitle className="flex items-center gap-2 text-sm"><CalendarClock className="size-4" />{i18n("auto.m0479")}</CardTitle></CardHeader><CardContent className="space-y-3 py-3"><EventGroup title={i18n("reservation.statuses.CHECK_IN_TODAY")} items={schedule.todayCheckIns} dateKey="startDate" /><EventGroup title={i18n("reservation.statuses.CHECK_OUT_TODAY")} items={schedule.todayCheckOuts} dateKey="endDate" /><EventGroup title={i18n("auto.m0480")} items={schedule.nextCheckIns} dateKey="startDate" /><EventGroup title={i18n("auto.m0481")} items={schedule.nextCheckOuts} dateKey="endDate" /><section><div className="mb-1.5 flex items-center justify-between"><h3 className="flex items-center gap-1 text-xs font-semibold"><AlertTriangle className="size-3 text-destructive" />{i18n("conflict.active")}</h3><span className="text-[10px] text-muted-foreground">{conflicts.length}{i18n("auto.m0013")}</span></div>{conflicts.length ? <ul className="space-y-1.5">{conflicts.slice(0, 8).map((item) => <li key={item.id} className="rounded-md border border-destructive/30 bg-destructive/5 p-2"><p className="text-xs font-semibold">{formatRoomDisplayName(item.room)}</p><p className="mt-1 text-[10px] text-muted-foreground">{dateFormatter.format(item.overlapStart)} → {dateFormatter.format(item.overlapEnd)}</p></li>)}</ul> : <p className="rounded-md border border-dashed p-2 text-center text-[10px] text-muted-foreground">{i18n("conflict.activeNone")}</p>}</section></CardContent></Card>;
}
