import "server-only";

import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getZonedDayRange } from "@/lib/zoned-date";

export interface CalendarSourceReservationCounts {
  active: number;
  historical: number;
  cancelled: number;
  total: number;
}

const EMPTY_COUNTS: CalendarSourceReservationCounts = {
  active: 0,
  historical: 0,
  cancelled: 0,
  total: 0,
};

type GroupedCount = { calendarSourceId: string; _count?: true | { _all?: number } };

function toCountMap(rows: GroupedCount[]) {
  return new Map(rows.map((row) => [
    row.calendarSourceId,
    typeof row._count === "object" ? row._count._all ?? 0 : 0,
  ]));
}

export async function findCalendarSourceReservationCounts(
  calendarSourceIds: readonly string[],
  now = new Date(),
) {
  const ids = [...new Set(calendarSourceIds)];
  if (ids.length === 0) return new Map<string, CalendarSourceReservationCounts>();

  const historicalBefore = getZonedDayRange(now).start;
  const sourceWhere = { calendarSourceId: { in: ids } } satisfies Prisma.ReservationWhereInput;
  const activeStatusWhere = { status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] } } satisfies Prisma.ReservationWhereInput;
  const [activeRows, historicalRows, cancelledRows, totalRows] = await Promise.all([
    prisma.reservation.groupBy({
      by: ["calendarSourceId"],
      where: { ...sourceWhere, ...activeStatusWhere, endDate: { gte: historicalBefore } },
      _count: { _all: true },
    }),
    prisma.reservation.groupBy({
      by: ["calendarSourceId"],
      where: { ...sourceWhere, ...activeStatusWhere, endDate: { lt: historicalBefore } },
      _count: { _all: true },
    }),
    prisma.reservation.groupBy({
      by: ["calendarSourceId"],
      where: { ...sourceWhere, status: "CANCELLED" },
      _count: { _all: true },
    }),
    prisma.reservation.groupBy({
      by: ["calendarSourceId"],
      where: sourceWhere,
      _count: { _all: true },
    }),
  ]);

  const activeBySource = toCountMap(activeRows);
  const historicalBySource = toCountMap(historicalRows);
  const cancelledBySource = toCountMap(cancelledRows);
  const totalBySource = toCountMap(totalRows);

  return new Map(ids.map((calendarSourceId) => [calendarSourceId, {
    active: activeBySource.get(calendarSourceId) ?? EMPTY_COUNTS.active,
    historical: historicalBySource.get(calendarSourceId) ?? EMPTY_COUNTS.historical,
    cancelled: cancelledBySource.get(calendarSourceId) ?? EMPTY_COUNTS.cancelled,
    total: totalBySource.get(calendarSourceId) ?? EMPTY_COUNTS.total,
  }]));
}
