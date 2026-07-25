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

export const dynamic = "force-dynamic";

const formatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Asia/Tokyo",
});

interface UnknownEventDetail {
  provider: string;
  uid: string;
  summary: string | null;
  descriptionPreview: string | null;
  status: string | null;
  reason: string;
}

function readUnknownEventDetails(value: unknown): UnknownEventDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const detail = item as Record<string, unknown>;
    if (typeof detail.provider !== "string" || typeof detail.uid !== "string" || typeof detail.reason !== "string") return [];
    return [{
      provider: detail.provider,
      uid: detail.uid,
      summary: typeof detail.summary === "string" ? detail.summary : null,
      descriptionPreview: typeof detail.descriptionPreview === "string" ? detail.descriptionPreview : null,
      status: typeof detail.status === "string" ? detail.status : null,
      reason: detail.reason,
    }];
  });
}

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
              <TableHead>시작</TableHead><TableHead>완료</TableHead><TableHead>소요</TableHead><TableHead>상태</TableHead><TableHead>VEVENT</TableHead><TableHead>이벤트 분류</TableHead><TableHead>생성</TableHead><TableHead>수정</TableHead><TableHead>취소 처리</TableHead><TableHead>오류</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((log) => {
              const unknownDetails = readUnknownEventDetails(log.unknownEventDetails);
              return <TableRow key={log.id}>
                <TableCell>{formatter.format(log.startedAt)}</TableCell>
                <TableCell>{log.completedAt ? formatter.format(log.completedAt) : "진행 중"}</TableCell>
                <TableCell>{differenceInMilliseconds(log.completedAt ?? now, log.startedAt)}ms{!log.completedAt && " (진행 중)"}</TableCell>
                <TableCell><Badge variant={log.status === "FAILED" || log.status === "TIMEOUT" ? "destructive" : "outline"}>{log.status}</Badge></TableCell>
                <TableCell>{log.fetchedCount}</TableCell>
                <TableCell>
                  <div className="whitespace-nowrap text-xs leading-5 text-muted-foreground">
                    <p>파싱 {log.parsedEventCount} · 예약 {log.reservationEventCount} · 차단 {log.blockedEventCount}</p>
                    <p>취소 {log.cancelledEventCount} · 미분류 {log.unknownEventCount} · 건너뜀 {log.skippedEventCount}</p>
                  </div>
                </TableCell>
                <TableCell>{log.createdCount}</TableCell><TableCell>{log.updatedCount}</TableCell><TableCell>{log.cancelledCount}</TableCell>
                <TableCell className="max-w-96"><p className="truncate">{log.errorMessage ?? "-"}</p>{unknownDetails.length > 0 && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">미분류 샘플 {unknownDetails.length}건</summary><ul className="mt-1 space-y-1">{unknownDetails.map((detail, index) => <li key={`${detail.uid}-${index}`} className="rounded border p-1.5"><p>{detail.provider} · UID {detail.uid} · {detail.status ?? "STATUS 없음"}</p><p>{detail.summary ?? "SUMMARY 없음"}</p>{detail.descriptionPreview && <p className="truncate">{detail.descriptionPreview}</p>}<p>{detail.reason}</p></li>)}</ul></details>}</TableCell>
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
