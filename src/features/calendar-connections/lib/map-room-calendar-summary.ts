import { maskCalendarUrl } from "../../calendar-sources/calendar-source-url";
import { formatRoomDisplayName } from "../../rooms/room-display";
import { getRoomCalendarStatus } from "./get-room-calendar-status";
import type { RoomCalendarSummary } from "../types/room-calendar-summary";
import type { CalendarProviderType, SyncExecutionMode, SyncStatus } from "@/lib/generated/prisma/enums";
import { getCalendarSyncHealth, type CalendarSyncHealth } from "../../calendar-sync/domain/sync-health";
import { readCalendarFeedQuarantineReasons } from "../../calendar-sync/domain/calendar-feed-safety";

interface RunLog { calendarSourceId: string; provider: CalendarProviderType; status: SyncStatus; startedAt: Date; completedAt: Date | null; fetchedCount: number; reservationEventCount: number; blockedEventCount: number; cancelledEventCount: number; unknownEventCount: number; failedEventCount: number; createdCount: number; updatedCount: number; cancelledCount: number; retryCount: number; httpStatus: number | null; errorCode: string | null; errorMessage: string | null; errorDetails: string | null; durationMs: number | null }
interface MapperRun { id: string; status: SyncStatus; executionMode: SyncExecutionMode; startedAt: Date; finishedAt: Date | null; targetCount: number; successCount: number; failedCount: number; errorSummary: string | null; actor: { name: string } | null; syncLogs: RunLog[] }
export interface RoomCalendarMapperInput { id: string; name: string; propertyId: string; property: { name: string }; calendarSources: Array<{ id: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean; connectionStatus: "NORMAL" | "RECONNECT_REQUIRED"; safetyReasonCodes: unknown; lastSyncedAt: Date | null; _count: { reservations: number }; reservations: Array<{ id: string }> }>; syncRuns: MapperRun[]; _count: { reservations: number }; conflicts: Array<{ id: string }> }

function logHealth(log: RunLog, previousSuccessfulReservationEventCount: number | null = null, persistedReservationCount: number | null = null): CalendarSyncHealth {
  return getCalendarSyncHealth({
    status: log.status,
    fetchedEventCount: log.fetchedCount,
    reservationEventCount: log.reservationEventCount,
    blockedEventCount: log.blockedEventCount,
    cancelledEventCount: log.cancelledEventCount,
    unknownEventCount: log.unknownEventCount,
    failedEventCount: log.failedEventCount,
    previousSuccessfulReservationEventCount,
    expectedPersistedReservationCount: persistedReservationCount === null ? null : log.reservationEventCount,
    persistedReservationCount,
  });
}

export function mapRoomCalendarSummary(room: RoomCalendarMapperInput, _now = new Date(), canViewTechnicalDetails = false): RoomCalendarSummary {
  void _now;
  const roomName = formatRoomDisplayName(room);
  const activeSourceCount = room.calendarSources.filter((source) => source.isActive).length;
  const latestRun = room.syncRuns[0] ?? null;
  const allLogs = room.syncRuns
    .flatMap((run) => run.syncLogs)
    .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
  const previousSuccessfulReservationCount = (log: RunLog) => {
    const index = allLogs.indexOf(log);
    const previous = allLogs.slice(index + 1).find((candidate) => candidate.calendarSourceId === log.calendarSourceId && candidate.status === "SUCCESS");
    return previous?.reservationEventCount ?? null;
  };
  const hasWarning = (log: RunLog) => logHealth(log, previousSuccessfulReservationCount(log)).status === "WARNING";
  const sourceReservationCountById = new Map(room.calendarSources.map((source) => [source.id, source._count.reservations]));
  const latestLogHasWarning = (log: RunLog) => logHealth(
    log,
    previousSuccessfulReservationCount(log),
    sourceReservationCountById.get(log.calendarSourceId) ?? null,
  ).status === "WARNING";
  const reconnectRequired = room.calendarSources.some((source) => source.isActive && source.connectionStatus === "RECONNECT_REQUIRED");
  const status = getRoomCalendarStatus({ activeSourceCount, targetCount: latestRun?.targetCount, successCount: latestRun?.successCount, failedCount: latestRun?.failedCount, running: latestRun?.status === "RUNNING", reconnectRequired, warning: latestRun?.syncLogs.some(latestLogHasWarning) });
  const latestLogs = new Map((latestRun?.syncLogs ?? []).map((log) => [log.calendarSourceId, log]));
  const sources = room.calendarSources.map((source) => {
    const log = latestLogs.get(source.id) ?? null;
    const health = log ? logHealth(log, previousSuccessfulReservationCount(log), source._count.reservations) : getCalendarSyncHealth({ status: null, fetchedEventCount: 0, reservationEventCount: 0, blockedEventCount: 0, cancelledEventCount: 0, unknownEventCount: 0, failedEventCount: 0 });
    const isWarning = health.status === "WARNING";
    return { id: source.id, roomId: room.id, roomName, propertyId: room.propertyId, propertyName: room.property.name, provider: source.provider, name: source.name, maskedUrl: maskCalendarUrl(source.calendarUrl), isActive: source.isActive, connectionStatus: source.connectionStatus, safetyReasonCodes: canViewTechnicalDetails ? readCalendarFeedQuarantineReasons(source.safetyReasonCodes) : [], lastSyncedAt: source.lastSyncedAt,
      latestSyncStatus: log?.status ?? null, latestSyncStartedAt: log?.startedAt ?? null, latestSyncCompletedAt: log?.completedAt ?? null, latestFetchedCount: log?.fetchedCount ?? 0, latestCreatedCount: log?.createdCount ?? 0, latestUpdatedCount: log?.updatedCount ?? 0, latestCancelledCount: log?.cancelledCount ?? 0, latestReservationEventCount: log?.reservationEventCount ?? 0, latestBlockedCount: log?.blockedEventCount ?? 0, latestUnknownCount: log?.unknownEventCount ?? 0, latestFailedEventCount: log?.failedEventCount ?? 0, latestRetryCount: log?.retryCount ?? 0, latestHttpStatus: log?.httpStatus ?? null, latestErrorCode: log?.errorCode ?? null, latestErrorDetails: canViewTechnicalDetails ? log?.errorDetails ?? null : null, latestErrorMessage: log?.errorMessage ?? null, latestDurationMs: log?.durationMs ?? null, isSyncing: log?.status === "RUNNING", isWarning, currentReservationCount: source._count.reservations, currentVisibleReservationCount: source.reservations.length, healthStatus: health.status, warningReasons: health.warningReasons };
  });
  return { roomId: room.id, roomName, propertyId: room.propertyId, propertyName: room.property.name, sources, providerCount: new Set(sources.map((source) => source.provider)).size, activeSourceCount, reservationCount: room._count.reservations, conflictCount: room.conflicts.length,
    lastSyncedAt: latestRun?.finishedAt ?? latestRun?.startedAt ?? null, status,
    latestRun: latestRun ? { id: latestRun.id, targetCount: latestRun.targetCount, successCount: latestRun.successCount, failedCount: latestRun.failedCount, startedAt: latestRun.startedAt, finishedAt: latestRun.finishedAt } : null,
    history: room.syncRuns.map((run) => ({ id: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt, executionMode: run.executionMode, targetCount: run.targetCount, successCount: run.successCount, failedCount: run.failedCount, status: getRoomCalendarStatus({ activeSourceCount, targetCount: run.targetCount, successCount: run.successCount, failedCount: run.failedCount, running: run.status === "RUNNING", warning: run.syncLogs.some(hasWarning) }), actorName: run.actor?.name ?? (run.executionMode === "AUTO" ? "시스템" : "알 수 없음"), errorSummary: run.errorSummary })),
    failureSummaries: (latestRun?.syncLogs ?? []).filter((log) => log.status === "FAILED" || log.status === "TIMEOUT").map((log) => ({ provider: log.provider, message: log.errorMessage ?? "동기화 실패" })),
  };
}
