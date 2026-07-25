import "server-only";
import { prisma } from "@/lib/prisma";
import { roomScopeWhere, type AccessScope } from "@/features/access-control";
import type { Prisma } from "@/lib/generated/prisma/client";

export const SYNC_LOG_PAGE_SIZE = 25;

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
  const rows = source ? await prisma.syncLog.findMany({
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
      skippedEventCount: true,
      createdCount: true,
      updatedCount: true,
      cancelledCount: true,
      errorMessage: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * SYNC_LOG_PAGE_SIZE,
    take: SYNC_LOG_PAGE_SIZE,
  }) : [];
  return { source, rows, totalCount, totalPages, page };
}
