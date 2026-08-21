"use client";import { useTranslations, useLocale } from "next-intl";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Power, RefreshCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarRoomOption } from "@/features/calendar-sources";
import { CalendarConnectionTest, CalendarManualSync, CalendarSourceActiveForm } from "@/features/calendar-sources/components/calendar-source-actions";
import { CalendarSourceForm } from "@/features/calendar-sources/components/calendar-source-form";
import { CalendarSourceDeleteDialog } from "@/features/calendar-sources/components/calendar-source-delete-dialog";
import { CalendarSourceUrlReplaceDialog } from "@/features/calendar-sources/components/calendar-source-url-replace-dialog";
import type { CalendarSourceSummary } from "../types/room-calendar-summary";
import { getProviderLabel } from "@/features/reservations/provider-visuals";




function SyncStatus({ source }: {source: CalendarSourceSummary;}) {const i18n = useTranslations();
  if (source.isSyncing) return <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-700 dark:text-blue-300"><RefreshCcw className="animate-spin" />{i18n("sync.statuses.RUNNING")}</Badge>;
  if (source.connectionStatus === "RECONNECT_REQUIRED") return <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"><AlertTriangle />{i18n("calendarStatus.RECONNECT_REQUIRED")}</Badge>;
  if (source.isWarning) return <Badge variant="outline" className="gap-1 border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300"><AlertTriangle />{i18n("auto.m0031")}</Badge>;
  if (source.latestSyncStatus === "SUCCESS") return <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"><CheckCircle2 />{i18n("auto.m0206")}</Badge>;
  if (source.latestSyncStatus === "FAILED" || source.latestSyncStatus === "TIMEOUT") return <Badge variant="destructive" className="gap-1"><XCircle />{source.latestSyncStatus === "TIMEOUT" ? i18n("sync.statuses.TIMEOUT") : i18n("auto.m0208")}</Badge>;
  return <Badge variant="outline" className="gap-1"><Clock3 />{i18n("auto.m0209")}</Badge>;
}

export function CalendarSourceCard({ source, rooms, showActions = true, canManage = false, onSourceDeleted, onSourceUpdated }: {source: CalendarSourceSummary;rooms: CalendarRoomOption[];showActions?: boolean;canManage?: boolean;onSourceDeleted?: (calendarSourceId: string, message: string) => void;onSourceUpdated?: (message: string) => void;}) {const locale = useLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const formatter = new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });const i18n = useTranslations();const formatDate = (value: Date | null) => value ? formatter.format(value) : i18n("auto.m0465");
  return (
    <Card size="sm" className="overflow-visible">
      <CardHeader className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{getProviderLabel(source.provider, i18n)}</Badge><Badge variant={source.isActive ? "outline" : "secondary"}>{source.isActive ? i18n("auto.m0210") : i18n("auto.m0115")}</Badge></div>
          <CardTitle className="truncate pt-1">{source.name}</CardTitle>
        </div>
        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          <SyncStatus source={source} />
          {showActions && canManage && onSourceDeleted && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end" data-calendar-source-management>
            <CalendarSourceForm rooms={rooms} source={source} onSaved={onSourceUpdated} />
            <CalendarSourceUrlReplaceDialog calendarSourceId={source.id} provider={source.provider} reconnectRequired={source.connectionStatus === "RECONNECT_REQUIRED"} onUpdated={onSourceUpdated} />
            <CalendarSourceDeleteDialog source={source} onDeleted={onSourceDeleted} showButtonLabelOnMobile />
          </div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="space-y-1"><p className="font-medium text-foreground">{i18n("technical.icsUrl")}</p><p className="break-all font-mono leading-5 text-muted-foreground">{source.maskedUrl}</p></div>
          <div className="space-y-1"><p className="font-medium text-foreground">{i18n("auto.m0211")}</p><p className="leading-5 text-muted-foreground">{i18n("auto.m0212")}</p></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-3">
          <div><dt className="text-muted-foreground">{i18n("auto.m0213")}</dt><dd className="mt-0.5 font-medium">{formatDate(source.latestSyncCompletedAt ?? source.lastSyncedAt)}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("technical.vevent")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestFetchedCount}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("auto.m0214")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestReservationEventCount}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("auto.m0215")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestCreatedCount}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("auto.m0216")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestUpdatedCount}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("auto.m0217")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestCancelledCount}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("auto.m0218")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestBlockedCount}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("technical.unknown")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestUnknownCount}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("auto.m0219")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestFailedEventCount}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("auto.m0220")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestRetryCount}{i18n("auto.m0221")}</dd></div>
          <div><dt className="text-muted-foreground">{i18n("auto.m0222")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestDurationMs === null ? "-" : `${source.latestDurationMs}ms`}</dd></div>
          {source.latestHttpStatus !== null && <div><dt className="text-muted-foreground">{i18n("technical.http")}</dt><dd className="mt-0.5 font-medium tabular-nums">{source.latestHttpStatus}</dd></div>}
          <div><dt className="text-muted-foreground">{i18n("auto.m0223")}</dt><dd className="mt-0.5 font-medium">{formatDate(source.latestSyncStartedAt)}</dd></div>
        </dl>
        {source.connectionStatus === "RECONNECT_REQUIRED" && <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-amber-800 dark:text-amber-300"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{i18n("calendarFeedSafety.reconnectMessage")}</p></div>{source.safetyReasonCodes.length > 0 && <p className="pl-6 font-mono text-[11px]">{source.safetyReasonCodes.join(", ")}</p>}</div>}
        {source.isWarning && source.connectionStatus !== "RECONNECT_REQUIRED" && <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-amber-800 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{i18n("auto.m0224")}</p></div>}
        {source.latestErrorMessage && <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p className="break-words leading-5"><strong>{source.latestErrorCode}</strong>{source.latestErrorCode ? " · " : ""}{source.latestErrorMessage}</p></div>{source.latestErrorDetails && <details className="rounded border border-destructive/20 p-2"><summary className="cursor-pointer font-medium">{i18n("auto.m0225")}</summary><pre className="mt-2 whitespace-pre-wrap break-all font-mono">{source.latestErrorDetails}</pre></details>}</div>}
        {showActions && <div className="flex flex-wrap items-start gap-2 border-t pt-3">
          {canManage && <CalendarConnectionTest id={source.id} />}
          <CalendarManualSync id={source.id} disabled={!source.isActive || source.isSyncing || source.connectionStatus === "RECONNECT_REQUIRED"} />
          <Button nativeButton={false} render={<Link href={`/calendar-sources/${source.id}/sync-logs`} />} size="sm" variant="outline"><Clock3 />{i18n("auto.m0019")}</Button>
          {canManage && <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Power className="size-3.5" /><CalendarSourceActiveForm id={source.id} isActive={source.isActive} /></div>}
        </div>}
      </CardContent>
    </Card>);

}
