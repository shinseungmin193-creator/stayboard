import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { roomScopeWhere, type AccessScope } from "@/features/access-control";
import type { Prisma } from "@/lib/generated/prisma/client";

export const SYNC_LOG_PAGE_SIZE = 25;

function reservationDiagnostic({ rawUid, ...reservation }: { id: string; rawUid: string; startDate: Date; endDate: Date; status: "CONFIRMED" | "CANCELLED" | "BLOCKED" | "TENTATIVE" | "UNKNOWN"; createdAt: Date }, matchMethod: "EXACT" | "LEGACY_TIME_WINDOW") {
  return { ...reservation, uidFingerprint: createHash("sha256").update(rawUid).digest("hex").slice(0, 12), matchMethod };
}

export async function listRecentFailedSyncLogs(input: { since: Date; requestedPage: number; companyIds?: readonly string[]; accessScope?: AccessScope }) {
  const roomScope = roomScopeWhere(input.accessScope);
  const where: Prisma.SyncLogWhereInput = {
    status: { in: ["FAILED", "TIMEOUT"] },
    startedAt: { gte: input.since },
    calendarSource: { room: roomScope ?? (input.companyIds ? { property: { companyId: { in: [...input.companyIds] } } } : undefined) },
  };
  const totalCount = await prisma.syncLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / SYNC_LOG_PAGE_SIZE));
  const page = Math.min(Math.max(1, input.requestedPage), totalPages);
  const rows = await prisma.syncLog.findMany({
    where,
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      status: true,
      provider: true,
      errorMessage: true,
      calendarSource: { select: { id: true, name: true, room: { select: { name: true, property: { select: { name: true } } } } } },
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * SYNC_LOG_PAGE_SIZE,
    take: SYNC_LOG_PAGE_SIZE,
  });
  return { rows, totalCount, totalPages, page };
}

export async function listCalendarSourceSyncLogs(calendarSourceId: string, requestedPage: number, companyIds?: readonly string[]) {
  const sourceWhere = { id: calendarSourceId, room: companyIds ? { property: { companyId: { in: [...companyIds] } } } : undefined };
  const [source, totalCount] = await Promise.all([
    prisma.calendarSource.findFirst({ where: sourceWhere, select: { id: true, name: true, provider: true, room: { select: { name: true, property: { select: { name: true } } } } } }),
    prisma.syncLog.count({ where: { calendarSourceId, calendarSource: companyIds ? { room: { property: { companyId: { in: [...companyIds] } } } } : undefined } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / SYNC_LOG_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const rawRows = source ? await prisma.syncLog.findMany({
    where: { calendarSourceId },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      status: true,
      fetchedCount: true,
      parsedEventCount: true,
      reservationEventCount: true,
      blockedEventCount: true,
      cancelledEventCount: true,
      unknownEventCount: true,
      unknownEventDetails: true,
      failedEventCount: true,
      eventDiagnostics: true,
      skippedEventCount: true,
      createdCount: true,
      updatedCount: true,
      cancelledCount: true,
      errorCode: true,
      errorMessage: true,
      errorDetails: true,
      quarantined: true,
      safetyDiagnostics: true,
      createdReservations: { select: { id: true, rawUid: true, startDate: true, endDate: true, status: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * SYNC_LOG_PAGE_SIZE,
    take: SYNC_LOG_PAGE_SIZE,
  }) : [];
  const legacyLogs = rawRows.filter((row) => row.createdCount > 0 && row.createdReservations.length === 0 && row.completedAt);
  const legacyCandidates = source && legacyLogs.length ? await prisma.reservation.findMany({
    where: {
      calendarSourceId,
      createdBySyncLogId: null,
      createdAt: {
        gte: new Date(Math.min(...legacyLogs.map((log) => log.startedAt.getTime()))),
        lte: new Date(Math.max(...legacyLogs.map((log) => (log.completedAt?.getTime() ?? log.startedAt.getTime()) + 60_000))),
      },
    },
    select: { id: true, rawUid: true, startDate: true, endDate: true, status: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  }) : [];
  const rows = rawRows.map((row, index) => {
    const exact = row.createdReservations.map((reservation) => reservationDiagnostic(reservation, "EXACT"));
    if (exact.length || !row.completedAt || row.createdCount === 0) return { ...row, createdReservations: exact };
    const nextSyncStartedAt = rawRows[index - 1]?.startedAt ?? null;
    const upperBound = new Date(Math.min(row.completedAt.getTime() + 60_000, nextSyncStartedAt?.getTime() ?? Number.POSITIVE_INFINITY));
    const candidates = legacyCandidates.filter((reservation) => reservation.createdAt >= row.startedAt && reservation.createdAt < upperBound);
    return { ...row, createdReservations: candidates.length === row.createdCount ? candidates.map((reservation) => reservationDiagnostic(reservation, "LEGACY_TIME_WINDOW")) : [] };
  });
  return { source, rows, totalCount, totalPages, page };
}
