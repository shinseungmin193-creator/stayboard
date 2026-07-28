import { getTranslations, getLocale } from "next-intl/server";import Link from "next/link";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { AccessDenied, authorizeAccess, companyScopeIds, PERMISSIONS } from "@/features/access-control";
import { listCalendarRoomOptions } from "@/features/calendar-sources";
import { CalendarSourceForm } from "@/features/calendar-sources/components/calendar-source-form";
import {
  listRoomCalendarSummaries,
  RoomCalendarFilterBar,
  RoomCalendarList,
  RoomCalendarSync,
  type RoomCalendarFilters as RoomCalendarFilterValues,
  type RoomCalendarStatus } from
"@/features/calendar-connections";
import { normalizeRoomCalendarSelection } from "@/features/calendar-connections/lib/normalize-room-calendar-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listRecentFailedSyncLogs } from "@/features/calendar-sync/sync-log.repository";
import { DASHBOARD_RECENT_SYNC_FAILURE_HOURS } from "@/features/dashboard/dashboard.constants";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import { getReservationSyncStatusLabel } from "@/features/reservations/reservation-status-meta";

export async function generateMetadata() {const i18n = await getTranslations();return { title: i18n("navigation.items.calendar-sources") };}
export const dynamic = "force-dynamic";

const providers = ["AIRBNB", "BOOKING", "AGODA"] as const;
const statuses = ["HEALTHY", "WARNING", "PARTIAL_FAILURE", "FAILED", "SYNCING", "NOT_SYNCED", "DISABLED"] as const;


export default async function CalendarSourcesPage({ searchParams }: {searchParams: Promise<Record<string, string | string[] | undefined>>;}) {const locale = await getLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const syncLogFormatter = new Intl.DateTimeFormat(localeTag, { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Tokyo" });const i18n = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.CALENDAR_SOURCE_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;

  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const providerValue = value("provider");
  const statusValue = value("status");
  const showRecentFailures = value("logStatus") === "FAILED" && value("hours") === String(DASHBOARD_RECENT_SYNC_FAILURE_HOURS);
  if (showRecentFailures) {
    const rawPage = Number(value("page"));
    const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const now = new Date();
    const result = await listRecentFailedSyncLogs({
      since: new Date(now.getTime() - DASHBOARD_RECENT_SYNC_FAILURE_HOURS * 60 * 60 * 1000),
      requestedPage,
      companyIds: companyScopeIds(access.context),
      accessScope: access.context.scope
    });
    const pageHref = (page: number) => `/calendar-sources?logStatus=FAILED&hours=${DASHBOARD_RECENT_SYNC_FAILURE_HOURS}&page=${page}`;
    return <div className="space-y-5">
      <PageHeader eyebrow="SYNC HISTORY" title={i18n("auto.m0001")} description={i18n("auto.m0002", { value0: DASHBOARD_RECENT_SYNC_FAILURE_HOURS, value1: result.totalCount })} action={<Button nativeButton={false} render={<Link href="/calendar-sources" />} variant="outline">{i18n("auto.m0003")}</Button>} />
      <Card className="overflow-x-auto py-0">
        {result.rows.length ? <Table><TableHeader><TableRow><TableHead>{i18n("auto.m0004")}</TableHead><TableHead>{i18n("auto.m0005")}</TableHead><TableHead>{i18n("auto.m0006")}</TableHead><TableHead>{i18n("technical.provider")}</TableHead><TableHead>{i18n("common.status")}</TableHead><TableHead>{i18n("sync.statuses.FAILED")}</TableHead><TableHead className="text-right">{i18n("common.details")}</TableHead></TableRow></TableHeader><TableBody>{result.rows.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap">{syncLogFormatter.format(log.startedAt)}</TableCell><TableCell><p className="font-medium">{log.calendarSource.room.property.name}</p><p className="text-xs text-muted-foreground">{formatRoomDisplayName(log.calendarSource.room)}</p></TableCell><TableCell>{log.calendarSource.name}</TableCell><TableCell>{getProviderLabel(log.provider, i18n)}</TableCell><TableCell><Badge variant="destructive">{getReservationSyncStatusLabel(log.status, i18n)}</Badge></TableCell><TableCell className="max-w-80 truncate">{log.errorMessage ?? "-"}</TableCell><TableCell className="text-right"><Button nativeButton={false} render={<Link href={`/calendar-sources/${log.calendarSource.id}/sync-logs`} />} size="sm" variant="outline">{i18n("auto.m0010")}</Button></TableCell></TableRow>)}</TableBody></Table> : <CardContent className="py-16 text-center text-sm text-muted-foreground">{i18n("auto.m0011")}</CardContent>}
      </Card>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{result.page} / {result.totalPages}{i18n("auto.m0012")}{result.totalCount}{i18n("auto.m0013")}</span><div className="flex gap-2"><Button nativeButton={false} render={<Link href={pageHref(Math.max(1, result.page - 1))} />} size="sm" variant="outline" disabled={result.page <= 1}>{i18n("auto.m0014")}</Button><Button nativeButton={false} render={<Link href={pageHref(Math.min(result.totalPages, result.page + 1))} />} size="sm" variant="outline" disabled={result.page >= result.totalPages}>{i18n("auto.m0015")}</Button></div></div>
    </div>;
  }
  const companyIds = companyScopeIds(access.context);
  const rooms = await listCalendarRoomOptions(companyIds, access.context.scope);
  const selection = normalizeRoomCalendarSelection(rooms, value("propertyId"), value("roomId"));
  const filters: RoomCalendarFilterValues = {
    propertyId: selection.propertyId,
    roomId: selection.roomId,
    provider: providers.includes(providerValue as typeof providers[number]) ? providerValue as CalendarProviderType : undefined,
    status: statuses.includes(statusValue as typeof statuses[number]) ? statusValue as RoomCalendarStatus : undefined,
    companyIds,
    accessScope: access.context.scope,
    canViewTechnicalDetails: access.context.role === "DEVELOPER"
  };

  const summaries = await listRoomCalendarSummaries(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="INTEGRATIONS"
        title={i18n("navigation.items.calendar-sources")}
        description={i18n("auto.m0017")}
        action={<div className="flex flex-wrap items-start gap-2"><RoomCalendarSync filters={filters} /><CalendarSourceForm rooms={rooms} /></div>} />
      
      <RoomCalendarFilterBar key={[filters.propertyId, filters.roomId, filters.provider, filters.status].join(":")} filters={filters} rooms={rooms} />
      <p className="text-xs leading-5 text-muted-foreground">{i18n("auto.m0018")}</p>
      <RoomCalendarList summaries={summaries} rooms={rooms} />
    </div>);

}
