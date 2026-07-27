import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInMilliseconds } from "date-fns";
import { AccessDenied, authorizeAccess, companyScopeIds, PERMISSIONS } from "@/features/access-control";
import { listCalendarSourceSyncLogs } from "@/features/calendar-sync/sync-log.repository";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import { readCalendarSyncDiagnosticPayload } from "@/features/calendar-sync/domain/calendar-sync-diagnostics";
import { isCalendarSyncWarning } from "@/features/calendar-sync/domain/sync-health";

export const dynamic = "force-dynamic";

const formatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Asia/Tokyo",
});
const eventDateFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" });
const eventDate = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : eventDateFormatter.format(date);
};

export default async function SyncLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await authorizeAccess(PERMISSIONS.SYNC_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;

  const { id } = await params;
  const query = await searchParams;
  const rawPage = typeof query.page === "string" ? Number(query.page) : 1;
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const result = await listCalendarSourceSyncLogs(id, requestedPage, companyScopeIds(access.context));
  if (!result.source) notFound();

  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="SYNC HISTORY"
        title="동기화 이력"
        description={`${result.source.room.property.name} · ${formatRoomDisplayName(result.source.room)} · ${result.source.name}`}
        action={<Button nativeButton={false} render={<Link href="/calendar-sources" />} variant="outline">목록으로</Button>}
      />
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시작</TableHead><TableHead>완료</TableHead><TableHead>소요</TableHead><TableHead>상태</TableHead><TableHead>처리 요약</TableHead><TableHead>이벤트 분류</TableHead><TableHead>생성</TableHead><TableHead>수정</TableHead><TableHead>취소 처리</TableHead><TableHead>진단</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((log) => {
              const diagnostics = readCalendarSyncDiagnosticPayload(log.eventDiagnostics, log.unknownEventDetails);
              const warning = isCalendarSyncWarning({ status: log.status, fetchedEventCount: log.fetchedCount, reservationEventCount: log.reservationEventCount, blockedEventCount: log.blockedEventCount, cancelledEventCount: log.cancelledEventCount, unknownEventCount: log.unknownEventCount, failedEventCount: log.failedEventCount });
              const reflectedCount = log.createdCount + log.updatedCount;
              const excludedCount = log.blockedEventCount + log.unknownEventCount + log.failedEventCount;
              return <TableRow key={log.id}>
                <TableCell>{formatter.format(log.startedAt)}</TableCell>
                <TableCell>{log.completedAt ? formatter.format(log.completedAt) : "진행 중"}</TableCell>
                <TableCell>{differenceInMilliseconds(log.completedAt ?? now, log.startedAt)}ms{!log.completedAt && " (진행 중)"}</TableCell>
                <TableCell><Badge variant={log.status === "FAILED" || log.status === "TIMEOUT" ? "destructive" : "outline"} className={warning ? "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300" : undefined}>{warning ? "주의" : log.status}</Badge></TableCell>
                <TableCell><div className="whitespace-nowrap text-xs leading-5"><p>다운로드 {log.fetchedCount} · 예약 반영 {reflectedCount}</p><p className="text-muted-foreground">제외 {excludedCount} · 알 수 없음 {log.unknownEventCount}</p></div></TableCell>
                <TableCell>
                  <div className="whitespace-nowrap text-xs leading-5 text-muted-foreground">
                    <p>파싱 {log.parsedEventCount} · 예약 {log.reservationEventCount} · 차단 {log.blockedEventCount}</p>
                    <p>취소 {log.cancelledEventCount} · 미분류 {log.unknownEventCount} · 파싱 실패 {log.failedEventCount}</p>
                  </div>
                </TableCell>
                <TableCell>{log.createdCount}</TableCell><TableCell>{log.updatedCount}</TableCell><TableCell>{log.cancelledCount}</TableCell>
                <TableCell className="max-w-[32rem]"><p className="truncate">{log.errorMessage ?? (warning ? "모든 이벤트가 UNKNOWN 또는 파싱 실패로 제외됨" : "-")}</p>{(diagnostics.events.length > 0 || Object.keys(diagnostics.exclusionReasonCounts).length > 0) && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">이벤트 진단 {diagnostics.events.length}건{diagnostics.truncatedEventCount > 0 ? ` 외 ${diagnostics.truncatedEventCount}건` : ""}</summary><div className="mt-2 space-y-2">{Object.keys(diagnostics.exclusionReasonCounts).length > 0 && <p>제외 사유: {Object.entries(diagnostics.exclusionReasonCounts).map(([reason, count]) => `${reason} ${count}`).join(" · ")}</p>}<ul className="space-y-1">{diagnostics.events.map((detail, index) => <li key={index} className="rounded border p-2"><p>UID {detail.uidPresent ? "있음" : "없음"} · {eventDate(detail.startDate)} → {eventDate(detail.endDate)}</p><p>STATUS {detail.status ?? "없음"} · SUMMARY {detail.summaryPreview ?? "없음"} · DESCRIPTION {detail.descriptionPresent ? "있음" : "없음"}</p><p>{detail.classification}{detail.exclusionReason ? ` · ${detail.exclusionReason}` : ""}</p></li>)}</ul></div></details>}</TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </Card>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{result.page} / {result.totalPages} 페이지 · {result.totalCount}건</span>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href={`?page=${Math.max(1, result.page - 1)}`} />} size="sm" variant="outline" disabled={result.page <= 1}>이전</Button>
          <Button nativeButton={false} render={<Link href={`?page=${Math.min(result.totalPages, result.page + 1)}`} />} size="sm" variant="outline" disabled={result.page >= result.totalPages}>다음</Button>
        </div>
      </div>
    </div>
  );
}
