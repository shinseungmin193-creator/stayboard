import "server-only";

import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control/infrastructure/prisma-scope";
import type { SyncStatus } from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { measureDashboardPrismaOperation } from "./dashboard-performance";

interface DashboardLatestSyncRow {
  status: SyncStatus;
  completedAt: Date | null;
}

export async function findDashboardSyncSummary(input: {
  recentSince: Date;
  companyIds?: readonly string[];
  accessScope?: AccessScope;
}) {
  const scopedRoom = roomScopeWhere(input.accessScope)
    ?? (input.companyIds ? { property: { companyId: { in: [...input.companyIds] } } } : undefined);
  const sources = await measureDashboardPrismaOperation("CalendarSource", "findMany", () => (
    prisma.calendarSource.findMany({
      where: scopedRoom ? { room: scopedRoom } : undefined,
      select: { id: true },
    })
  ));
  const sourceIds = sources.map((source) => source.id);
  if (!sourceIds.length) return { recentSyncFailures: 0, latestSync: null };

  const [recentSyncFailures, latestRows] = await Promise.all([
    measureDashboardPrismaOperation("SyncLog", "countRecentFailures", () => (
      prisma.syncLog.count({
        where: {
          calendarSourceId: { in: sourceIds },
          status: { in: ["FAILED", "TIMEOUT"] },
          startedAt: { gte: input.recentSince },
        },
      })
    )),
    measureDashboardPrismaOperation("SyncLog", "findLatestBySource", () => (
      prisma.$queryRaw<DashboardLatestSyncRow[]>(Prisma.sql`
        SELECT latest.status, latest."completedAt"
        FROM "CalendarSource" source
        JOIN LATERAL (
          SELECT log.status, log."completedAt", log."createdAt", log.id
          FROM "SyncLog" log
          WHERE log."calendarSourceId" = source.id
            AND log.status IN ('SUCCESS', 'FAILED', 'TIMEOUT')
          ORDER BY log."createdAt" DESC, log.id DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE source.id IN (${Prisma.join(sourceIds)})
        ORDER BY latest."createdAt" DESC, latest.id DESC
        LIMIT 1
      `)
    )),
  ]);

  return { recentSyncFailures, latestSync: latestRows[0] ?? null };
}
