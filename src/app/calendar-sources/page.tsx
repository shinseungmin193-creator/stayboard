import Link from "next/link";
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
  type RoomCalendarStatus,
} from "@/features/calendar-connections";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listRecentFailedSyncLogs } from "@/features/calendar-sync/sync-log.repository";
import { DASHBOARD_RECENT_SYNC_FAILURE_HOURS } from "@/features/dashboard/dashboard.constants";
import { formatRoomDisplayName } from "@/features/rooms/room-display";

export const metadata = { title: "캘린더 연결" };
export const dynamic = "force-dynamic";

const providers = ["AIRBNB", "BOOKING", "AGODA"] as const;
const statuses = ["HEALTHY", "PARTIAL_FAILURE", "FAILED", "SYNCING", "NOT_SYNCED", "DISABLED"] as const;
const syncLogFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Tokyo" });

export default async function CalendarSourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
      accessScope: access.context.scope,
    });
    const pageHref = (page: number) => `/calendar-sources?logStatus=FAILED&hours=${DASHBOARD_RECENT_SYNC_FAILURE_HOURS}&page=${page}`;
    return <div className="space-y-5">
      <PageHeader eyebrow="SYNC HISTORY" title="24시간 동기화 실패" description={`최근 ${DASHBOARD_RECENT_SYNC_FAILURE_HOURS}시간 실패 기록 ${result.totalCount}건`} action={<Button nativeButton={false} render={<Link href="/calendar-sources" />} variant="outline">캘린더 연결로</Button>} />
      <Card className="overflow-x-auto py-0">
        {result.rows.length ? <Table><TableHeader><TableRow><TableHead>시작</TableHead><TableHead>숙소 / 객실</TableHead><TableHead>연결</TableHead><TableHead>Provider</TableHead><TableHead>상태</TableHead><TableHead>오류</TableHead><TableHead className="text-right">상세</TableHead></TableRow></TableHeader><TableBody>{result.rows.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap">{syncLogFormatter.format(log.startedAt)}</TableCell><TableCell><p className="font-medium">{log.calendarSource.room.property.name}</p><p className="text-xs text-muted-foreground">{formatRoomDisplayName(log.calendarSource.room)}</p></TableCell><TableCell>{log.calendarSource.name}</TableCell><TableCell>{log.provider}</TableCell><TableCell><Badge variant="destructive">{log.status}</Badge></TableCell><TableCell className="max-w-80 truncate">{log.errorMessage ?? "-"}</TableCell><TableCell className="text-right"><Button nativeButton={false} render={<Link href={`/calendar-sources/${log.calendarSource.id}/sync-logs`} />} size="sm" variant="outline">전체 이력</Button></TableCell></TableRow>)}</TableBody></Table> : <CardContent className="py-16 text-center text-sm text-muted-foreground">최근 24시간 내 실패한 동기화 기록이 없습니다.</CardContent>}
      </Card>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{result.page} / {result.totalPages} 페이지 · {result.totalCount}건</span><div className="flex gap-2"><Button nativeButton={false} render={<Link href={pageHref(Math.max(1, result.page - 1))} />} size="sm" variant="outline" disabled={result.page <= 1}>이전</Button><Button nativeButton={false} render={<Link href={pageHref(Math.min(result.totalPages, result.page + 1))} />} size="sm" variant="outline" disabled={result.page >= result.totalPages}>다음</Button></div></div>
    </div>;
  }
  const filters: RoomCalendarFilterValues = {
    propertyId: value("propertyId"),
    roomId: value("roomId"),
    provider: providers.includes(providerValue as typeof providers[number]) ? providerValue as CalendarProviderType : undefined,
    status: statuses.includes(statusValue as typeof statuses[number]) ? statusValue as RoomCalendarStatus : undefined,
    companyIds: companyScopeIds(access.context),
    canViewTechnicalDetails: access.context.role === "DEVELOPER",
  };

  const [summaries, rooms] = await Promise.all([
    listRoomCalendarSummaries(filters),
    listCalendarRoomOptions(filters.companyIds),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="INTEGRATIONS"
        title="캘린더 연결"
        description="객실별 OTA 연결 상태를 한 행에서 확인하고 세부 연결을 관리합니다."
        action={<div className="flex flex-wrap items-start gap-2"><RoomCalendarSync roomIds={summaries.map((room) => room.roomId)} /><CalendarSourceForm rooms={rooms} /></div>}
      />
      <RoomCalendarFilterBar filters={filters} rooms={rooms} />
      <p className="text-xs leading-5 text-muted-foreground">Provider 필터는 해당 연결이 있는 객실을 찾으며, 상세 화면에서는 그 객실의 모든 OTA 연결을 함께 보여줍니다. 연결 테스트 결과는 현재 세션에서 즉시 확인할 수 있고 별도 저장되지는 않습니다.</p>
      <RoomCalendarList summaries={summaries} rooms={rooms} />
    </div>
  );
}
