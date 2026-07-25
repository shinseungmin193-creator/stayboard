"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Power, RefreshCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarRoomOption } from "@/features/calendar-sources";
import { CalendarConnectionTest, CalendarManualSync, CalendarSourceActiveForm } from "@/features/calendar-sources/components/calendar-source-actions";
import { CalendarSourceForm } from "@/features/calendar-sources/components/calendar-source-form";
import { CALENDAR_PROVIDER_LABELS, type CalendarSourceSummary } from "../types/room-calendar-summary";

const formatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });
const formatDate = (value: Date | null) => value ? formatter.format(value) : "기록 없음";

function SyncStatus({ source }: { source: CalendarSourceSummary }) {
  if (source.isSyncing) return <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-700 dark:text-blue-300"><RefreshCcw className="animate-spin" />동기화 중</Badge>;
  if (source.latestSyncStatus === "SUCCESS") return <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"><CheckCircle2 />성공</Badge>;
  if (source.latestSyncStatus === "FAILED" || source.latestSyncStatus === "TIMEOUT") return <Badge variant="destructive" className="gap-1"><XCircle />{source.latestSyncStatus === "TIMEOUT" ? "시간 초과" : "실패"}</Badge>;
  return <Badge variant="outline" className="gap-1"><Clock3 />동기화 전</Badge>;
}

export function CalendarSourceCard({ source, rooms, showActions = true }: { source: CalendarSourceSummary; rooms: CalendarRoomOption[]; showActions?: boolean }) {
  return (
    <Card size="sm" className="overflow-visible">
      <CardHeader className="grid-cols-[1fr_auto] items-start border-b pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{CALENDAR_PROVIDER_LABELS[source.provider]}</Badge><Badge variant={source.isActive ? "outline" : "secondary"}>{source.isActive ? "활성" : "비활성"}</Badge></div>
          <CardTitle className="truncate pt-1">{source.name}</CardTitle>
        </div>
        <SyncStatus source={source} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="space-y-1"><p className="font-medium text-foreground">ICS URL</p><p className="break-all font-mono leading-5 text-muted-foreground">{source.maskedUrl}</p></div>
          <div className="space-y-1"><p className="font-medium text-foreground">최근 연결 테스트</p><p className="leading-5 text-muted-foreground">결과가 별도로 저장되지 않습니다. 아래 연결 테스트에서 즉시 확인할 수 있습니다.</p></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-3">
          <div><dt className="text-muted-foreground">최근 동기화</dt><dd className="mt-0.5 font-medium">{formatDate(source.latestSyncCompletedAt ?? source.lastSyncedAt)}</dd></div>
          <div><dt className="text-muted-foreground">VEVENT</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestFetchedCount}</dd></div>
          <div><dt className="text-muted-foreground">신규 예약</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestCreatedCount}</dd></div>
          <div><dt className="text-muted-foreground">수정 예약</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestUpdatedCount}</dd></div>
          <div><dt className="text-muted-foreground">취소 예약</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestCancelledCount}</dd></div>
          <div><dt className="text-muted-foreground">BLOCKED 제외</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestBlockedCount}</dd></div>
          <div><dt className="text-muted-foreground">UNKNOWN</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestUnknownCount}</dd></div>
          <div><dt className="text-muted-foreground">재시도</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestRetryCount}회</dd></div>
          <div><dt className="text-muted-foreground">처리 시간</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestDurationMs === null ? "-" : `${source.latestDurationMs}ms`}</dd></div>
          {source.latestHttpStatus !== null && <div><dt className="text-muted-foreground">HTTP</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestHttpStatus}</dd></div>}
          <div><dt className="text-muted-foreground">시작 시각</dt><dd className="mt-0.5 font-medium">{formatDate(source.latestSyncStartedAt)}</dd></div>
        </dl>
        {source.latestErrorMessage && <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p className="break-words leading-5"><strong>{source.latestErrorCode}</strong>{source.latestErrorCode ? " · " : ""}{source.latestErrorMessage}</p></div>{source.latestErrorDetails && <details className="rounded border border-destructive/20 p-2"><summary className="cursor-pointer font-medium">기술 오류 원문 (DEVELOPER)</summary><pre className="mt-2 whitespace-pre-wrap break-all font-mono">{source.latestErrorDetails}</pre></details>}</div>}
        {showActions && <div className="flex flex-wrap items-start gap-2 border-t pt-3">
          <CalendarSourceForm rooms={rooms} source={source} />
          <CalendarConnectionTest id={source.id} />
          <CalendarManualSync id={source.id} disabled={!source.isActive || source.isSyncing} />
          <Button nativeButton={false} render={<Link href={`/calendar-sources/${source.id}/sync-logs`} />} size="sm" variant="outline"><Clock3 />동기화 이력</Button>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Power className="size-3.5" /><CalendarSourceActiveForm id={source.id} isActive={source.isActive} /></div>
        </div>}
      </CardContent>
    </Card>
  );
}
