import { getTranslations, getLocale } from "next-intl/server";import Link from "next/link";
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
import { getCalendarSyncHealth } from "@/features/calendar-sync/domain/sync-health";
import { getReservationSyncStatusLabel } from "@/features/reservations/reservation-status-meta";
import { readCalendarFeedSafetyDiagnostics } from "@/features/calendar-sync/domain/calendar-feed-safety";

export const dynamic = "force-dynamic";







const eventDate = (value: string, localeTag: string) => {const eventDateFormatter = new Intl.DateTimeFormat(localeTag, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" });
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : eventDateFormatter.format(date);
};

export default async function SyncLogsPage({
  params,
  searchParams



}: {params: Promise<{id: string;}>;searchParams: Promise<Record<string, string | string[] | undefined>>;}) {const locale = await getLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const formatter = new Intl.DateTimeFormat(localeTag, { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Tokyo" });const i18n = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.SYNC_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;

  const { id } = await params;
  const query = await searchParams;
  const rawPage = typeof query.page === "string" ? Number(query.page) : 1;
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const result = await listCalendarSourceSyncLogs(id, requestedPage, companyScopeIds(access.context));
  if (!result.source) notFound();
  const source = result.source;

  const now = new Date();
  const canViewTechnicalDetails = access.context.role === "DEVELOPER";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="SYNC HISTORY"
        title={i18n("auto.m0019")}
        description={`${source.room.property.name} · ${formatRoomDisplayName(source.room)} · ${source.name}`}
        action={<Button nativeButton={false} render={<Link href="/calendar-sources" />} variant="outline">{i18n("auto.m0020")}</Button>} />
      
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n("auto.m0004")}</TableHead><TableHead>{i18n("auto.m0021")}</TableHead><TableHead>{i18n("auto.m0022")}</TableHead><TableHead>{i18n("common.status")}</TableHead><TableHead>{i18n("auto.m0023")}</TableHead><TableHead>{i18n("auto.m0024")}</TableHead><TableHead>{i18n("auto.m0025")}</TableHead><TableHead>{i18n("common.edit")}</TableHead><TableHead>{i18n("auto.m0027")}</TableHead><TableHead>{i18n("auto.m0028")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((log, index) => {
              const diagnostics = readCalendarSyncDiagnosticPayload(log.eventDiagnostics, log.unknownEventDetails);
              const safetyDiagnostics = readCalendarFeedSafetyDiagnostics(log.safetyDiagnostics);
              const previousSuccessfulLog = result.rows.slice(index + 1).find((candidate) => candidate.status === "SUCCESS");
              const health = getCalendarSyncHealth({
                status: log.status,
                fetchedEventCount: log.fetchedCount,
                reservationEventCount: log.reservationEventCount,
                blockedEventCount: log.blockedEventCount,
                cancelledEventCount: log.cancelledEventCount,
                unknownEventCount: log.unknownEventCount,
                failedEventCount: log.failedEventCount,
                previousSuccessfulReservationEventCount: previousSuccessfulLog?.reservationEventCount ?? null,
                expectedPersistedReservationCount: index === 0 && result.page === 1 && log.status === "SUCCESS" ? log.reservationEventCount : null,
                persistedReservationCount: index === 0 && result.page === 1 && log.status === "SUCCESS" ? source._count.reservations : null,
              });
              const warning = health.status === "WARNING";
              const reflectedCount = log.createdCount + log.updatedCount;
              const excludedCount = log.blockedEventCount + log.unknownEventCount + log.failedEventCount;
              const healthLabel = warning
                ? i18n("sync.health.warningWithReservations", { count: index === 0 && result.page === 1 ? source._count.reservations : log.reservationEventCount })
                : log.status === "SUCCESS" && log.fetchedCount === 0
                  ? i18n("sync.health.emptyCalendar")
                  : log.status === "SUCCESS" && log.reservationEventCount === 0
                    ? i18n("sync.health.noReservations")
                    : log.status === "SUCCESS"
                      ? i18n("sync.health.successWithReservations", { count: log.reservationEventCount })
                      : getReservationSyncStatusLabel(log.status, i18n);
              return <TableRow key={log.id}>
                <TableCell>{formatter.format(log.startedAt)}</TableCell>
                <TableCell>{log.completedAt ? formatter.format(log.completedAt) : i18n("auto.m0029")}</TableCell>
                <TableCell>{differenceInMilliseconds(log.completedAt ?? now, log.startedAt)}ms{!log.completedAt && i18n("auto.m0030")}</TableCell>
                <TableCell><Badge variant={log.quarantined ? "outline" : log.status === "FAILED" || log.status === "TIMEOUT" ? "destructive" : "outline"} className={log.quarantined || warning ? "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300" : undefined}>{log.quarantined ? i18n("calendarStatus.RECONNECT_REQUIRED") : healthLabel}</Badge></TableCell>
                <TableCell><div className="whitespace-nowrap text-xs leading-5"><p>{i18n("auto.m0032")}{log.fetchedCount}{i18n("auto.m0033")}{reflectedCount}</p><p className="text-muted-foreground">{i18n("auto.m0034")}{excludedCount}{i18n("auto.m0035")}{log.unknownEventCount}</p></div></TableCell>
                <TableCell>
                  <div className="whitespace-nowrap text-xs leading-5 text-muted-foreground">
                    <p>{i18n("auto.m0036")}{log.parsedEventCount}{i18n("auto.m0037")}{log.reservationEventCount}{i18n("auto.m0038")}{log.blockedEventCount}</p>
                    <p>{i18n("common.cancel")}{log.cancelledEventCount}{i18n("auto.m0040")}{log.unknownEventCount}{i18n("auto.m0041")}{log.failedEventCount}</p>
                  </div>
                </TableCell>
                <TableCell>{log.createdCount}</TableCell><TableCell>{log.updatedCount}</TableCell><TableCell>{log.cancelledCount}</TableCell>
                <TableCell className="max-w-[32rem]"><p className="truncate">{log.errorMessage ?? (warning ? i18n("sync.health.warningDescription") : "-")}</p>{warning && health.warningReasons.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-amber-800 dark:text-amber-300">{health.warningReasons.map((reason) => <li key={reason}>{i18n(`sync.health.reasons.${reason}`)}</li>)}</ul>}{canViewTechnicalDetails && safetyDiagnostics && safetyDiagnostics.reasonCodes.length > 0 && <details className="mt-1 rounded border border-amber-500/30 p-2 text-xs text-amber-800 dark:text-amber-300"><summary className="cursor-pointer font-medium">Safety diagnostics</summary><p className="mt-1 font-mono">{safetyDiagnostics.reasonCodes.join(", ")}</p><p className="mt-1 tabular-nums">future {safetyDiagnostics.existingFutureReservationCount} · missing {safetyDiagnostics.missingFutureReservationCount} · unknown {Math.round(safetyDiagnostics.unknownRatio * 100)}% · new conflicts {safetyDiagnostics.newConflictCount}</p></details>}{canViewTechnicalDetails && log.createdReservations.length > 0 && <details className="mt-1 rounded border p-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">{i18n("calendarFeedSafety.createdReservations", { count: log.createdReservations.length })}</summary>{log.createdReservations.some((reservation) => reservation.matchMethod === "LEGACY_TIME_WINDOW") && <p className="mt-1 text-amber-700 dark:text-amber-300">{i18n("calendarFeedSafety.legacyMatchNote")}</p>}<ul className="mt-2 space-y-1">{log.createdReservations.map((reservation) => <li key={reservation.id} className="rounded border p-2"><p className="font-mono">UID hash: {reservation.uidFingerprint}</p><p>{eventDate(reservation.startDate.toISOString(), localeTag)} → {eventDate(reservation.endDate.toISOString(), localeTag)} · {reservation.status}</p><p>{formatter.format(reservation.createdAt)}</p></li>)}</ul></details>}{(diagnostics.events.length > 0 || Object.keys(diagnostics.exclusionReasonCounts).length > 0) && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">{i18n("auto.m0043")}{diagnostics.events.length}{i18n("auto.m0013")}{diagnostics.truncatedEventCount > 0 ? i18n("auto.m0044", { value0: diagnostics.truncatedEventCount }) : ""}</summary><div className="mt-2 space-y-2">{Object.keys(diagnostics.exclusionReasonCounts).length > 0 && <p>{i18n("auto.m0045")}{Object.entries(diagnostics.exclusionReasonCounts).map(([reason, count]) => `${reason} ${count}`).join(" · ")}</p>}<ul className="space-y-1">{diagnostics.events.map((detail, diagnosticIndex) => <li key={diagnosticIndex} className="rounded border p-2"><p>{i18n("technical.uid")} {detail.uidPresent ? i18n("auto.m0046") : i18n("auto.m0047")} · {eventDate(detail.startDate, localeTag)} → {eventDate(detail.endDate, localeTag)}</p><p>{i18n("technical.status")} {detail.status ?? i18n("auto.m0047")} · {i18n("technical.summary")} {detail.summaryPreview ?? i18n("auto.m0047")} · {i18n("technical.description")} {detail.descriptionPresent ? i18n("auto.m0046") : i18n("auto.m0047")}</p><p>{detail.classification}{detail.exclusionReason ? ` · ${detail.exclusionReason}` : ""}</p></li>)}</ul></div></details>}</TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </Card>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{result.page} / {result.totalPages}{i18n("auto.m0012")}{result.totalCount}{i18n("auto.m0013")}</span>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href={`?page=${Math.max(1, result.page - 1)}`} />} size="sm" variant="outline" disabled={result.page <= 1}>{i18n("auto.m0014")}</Button>
          <Button nativeButton={false} render={<Link href={`?page=${Math.min(result.totalPages, result.page + 1)}`} />} size="sm" variant="outline" disabled={result.page >= result.totalPages}>{i18n("auto.m0015")}</Button>
        </div>
      </div>
    </div>);

}
