import "server-only";

import {
  companyScopeIds,
  hasPermission,
  PERMISSIONS,
  PermissionDeniedError,
  propertyScopeWhere,
  roomScopeWhere,
  type AccessContext,
} from "@/features/access-control";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getZonedMidnight, isValidDateInput, shiftDateInput } from "@/lib/zoned-date";
import {
  CLEANING_STATS_UNSPECIFIED_VALUE,
  type CleaningStatsFilters,
  type CleaningStatsPageData,
} from "../cleaning-stats.types";
import { parseCleaningStatsRange } from "../domain/cleaning-stats-date";
import {
  buildCleaningStatsCleanerWhere,
  buildCleaningStatsTaskWhere,
  sortCleaningStatsGroups,
} from "../domain/cleaning-stats-policy";

const DETAIL_PAGE_SIZE = 20;

function buildStatsWhere(
  context: AccessContext,
  filters: CleaningStatsFilters,
  range: ReturnType<typeof parseCleaningStatsRange>,
  options: { includeCleaner?: boolean } = {},
): Prisma.CleaningTaskWhereInput {
  const scopedRoom = roomScopeWhere(context.scope);
  return buildCleaningStatsTaskWhere({
    start: range.start,
    toExclusive: range.toExclusive,
    roomWhere: scopedRoom,
    companyId: filters.companyId,
    propertyId: filters.propertyId,
    cleanerName: options.includeCleaner === false ? null : filters.cleanerName,
  });
}

function rawStatsConditions(
  context: AccessContext,
  filters: CleaningStatsFilters,
  range: ReturnType<typeof parseCleaningStatsRange>,
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`task."status" = 'COMPLETED'::"CleaningTaskStatus"`,
    Prisma.sql`task."completedAt" >= ${range.start}`,
    Prisma.sql`task."completedAt" < ${range.toExclusive}`,
  ];
  if (context.scope.mode === "companies") {
    conditions.push(context.scope.companyIds.length
      ? Prisma.sql`task."companyId" IN (${Prisma.join([...context.scope.companyIds])})`
      : Prisma.sql`FALSE`);
    if (context.scope.propertyIds !== undefined || context.scope.roomIds !== undefined) {
      const accessConditions: Prisma.Sql[] = [];
      if (context.scope.propertyIds?.length) {
        accessConditions.push(Prisma.sql`task."propertyId" IN (${Prisma.join([...context.scope.propertyIds])})`);
      }
      if (context.scope.roomIds?.length) {
        accessConditions.push(Prisma.sql`task."roomId" IN (${Prisma.join([...context.scope.roomIds])})`);
      }
      conditions.push(accessConditions.length
        ? Prisma.sql`(${Prisma.join(accessConditions, " OR ")})`
        : Prisma.sql`FALSE`);
    }
  }
  if (filters.companyId) conditions.push(Prisma.sql`task."companyId" = ${filters.companyId}`);
  if (filters.propertyId) conditions.push(Prisma.sql`task."propertyId" = ${filters.propertyId}`);
  if (filters.cleanerName === CLEANING_STATS_UNSPECIFIED_VALUE) {
    conditions.push(Prisma.sql`task."cleanerName" IS NULL`);
  } else if (filters.cleanerName) {
    conditions.push(Prisma.sql`task."cleanerName" = ${filters.cleanerName}`);
  }
  return conditions;
}

function detailWhere(
  context: AccessContext,
  filters: CleaningStatsFilters,
  range: ReturnType<typeof parseCleaningStatsRange>,
): Prisma.CleaningTaskWhereInput | null {
  if (!filters.detailCleanerName) return null;
  const dayRange = isValidDateInput(filters.detailDate)
    ? {
        gte: getZonedMidnight(filters.detailDate, range.timeZone),
        lt: getZonedMidnight(shiftDateInput(filters.detailDate, 1), range.timeZone),
      }
    : { gte: range.start, lt: range.toExclusive };
  return {
    AND: [
      buildStatsWhere(context, filters, range, { includeCleaner: false }),
      buildCleaningStatsCleanerWhere(filters.detailCleanerName),
      { completedAt: dayRange },
    ],
  };
}

export async function getCleaningStatsPage(
  context: AccessContext,
  filters: CleaningStatsFilters,
): Promise<CleaningStatsPageData> {
  if (!hasPermission(context.role, PERMISSIONS.STATISTICS_READ)) throw new PermissionDeniedError();
  const range = parseCleaningStatsRange({ from: filters.from, to: filters.to });
  const where = buildStatsWhere(context, filters, range);
  const optionWhere = buildStatsWhere(context, filters, range, { includeCleaner: false });
  const detailsWhere = detailWhere(context, filters, range);
  const companyIds = companyScopeIds(context);
  const propertyScope = propertyScopeWhere(context.scope);
  const rawConditions = rawStatsConditions(context, filters, range);
  const detailPage = filters.page;

  const [
    totalCount,
    workerRows,
    workerOptionRows,
    dailyRows,
    companies,
    properties,
    detailTotalCount,
  ] = await Promise.all([
    prisma.cleaningTask.count({ where }),
    prisma.cleaningTask.groupBy({ by: ["cleanerName"], where, _count: { _all: true } }),
    prisma.cleaningTask.groupBy({ by: ["cleanerName"], where: optionWhere, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ date: string; cleanerName: string | null; count: number }>>(Prisma.sql`
      SELECT
        to_char(task."completedAt" AT TIME ZONE ${range.timeZone}, 'YYYY-MM-DD') AS "date",
        task."cleanerName" AS "cleanerName",
        COUNT(*)::int AS "count"
      FROM "CleaningTask" task
      WHERE ${Prisma.join(rawConditions, " AND ")}
      GROUP BY 1, task."cleanerName"
      ORDER BY 1 DESC, 3 DESC, task."cleanerName" ASC NULLS LAST
    `),
    prisma.company.findMany({
      where: { isActive: true, ...(companyIds ? { id: { in: [...companyIds] } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: { isActive: true, ...(propertyScope ?? {}) },
      select: { id: true, name: true, companyId: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    detailsWhere ? prisma.cleaningTask.count({ where: detailsWhere }) : Promise.resolve(0),
  ]);

  const detailTotalPages = Math.max(1, Math.ceil(detailTotalCount / DETAIL_PAGE_SIZE));
  const safeDetailPage = Math.min(detailPage, detailTotalPages);
  const detailRows = detailsWhere ? await prisma.cleaningTask.findMany({
      where: detailsWhere,
      select: {
        id: true,
        completedAt: true,
        cleanerName: true,
        completedByName: true,
        completedBy: { select: { name: true } },
        company: { select: { name: true } },
        property: { select: { name: true } },
        room: { select: { name: true } },
        note: true,
        _count: { select: { photos: { where: { storageKey: { not: null }, deletedAt: null } } } },
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      skip: (safeDetailPage - 1) * DETAIL_PAGE_SIZE,
      take: DETAIL_PAGE_SIZE,
    }) : [];

  const workerTotals = sortCleaningStatsGroups(workerRows
    .map((row) => ({ cleanerName: row.cleanerName, count: row._count._all })));
  const workerOptions = sortCleaningStatsGroups(workerOptionRows
    .map((row) => ({
      cleanerName: row.cleanerName,
      count: row._count._all,
    })))
    .map(({ cleanerName }) => ({ value: cleanerName ?? CLEANING_STATS_UNSPECIFIED_VALUE, name: cleanerName }));
  return {
    range: { from: range.from, to: range.to },
    timeZone: range.timeZone,
    totalCount,
    dailyGroups: dailyRows.map((row) => ({ ...row, count: Number(row.count) })),
    workerTotals,
    workerOptions,
    details: detailRows.map((task) => ({
      id: task.id,
      completedAt: task.completedAt?.toISOString() ?? "",
      companyName: task.company.name,
      propertyName: task.property.name,
      roomName: task.room.name,
      cleanerName: task.cleanerName,
      completedByName: task.cleanerName === null
        ? task.completedBy?.name ?? task.completedByName
        : task.completedByName ?? task.completedBy?.name ?? null,
      photoCount: task._count.photos,
      note: task.note,
    })),
    detailTotalCount,
    detailTotalPages,
    detailPage: safeDetailPage,
    companies,
    properties,
  };
}
