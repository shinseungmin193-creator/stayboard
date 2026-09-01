import type { Prisma } from "@/lib/generated/prisma/client";
import { CLEANING_STATS_UNSPECIFIED_VALUE } from "../cleaning-stats.types";

export function buildCleaningStatsCleanerWhere(value: string | null): Prisma.CleaningTaskWhereInput {
  if (!value) return {};
  return value === CLEANING_STATS_UNSPECIFIED_VALUE
    ? { cleanerName: null }
    : { cleanerName: value };
}

export function buildCleaningStatsTaskWhere(input: {
  start: Date;
  toExclusive: Date;
  roomWhere?: Prisma.RoomWhereInput;
  companyId?: string | null;
  propertyId?: string | null;
  cleanerName?: string | null;
}): Prisma.CleaningTaskWhereInput {
  return {
    AND: [
      { status: "COMPLETED" },
      { completedAt: { gte: input.start, lt: input.toExclusive } },
      ...(input.roomWhere ? [{ room: { is: input.roomWhere } }] : []),
      ...(input.companyId ? [{ companyId: input.companyId }] : []),
      ...(input.propertyId ? [{ propertyId: input.propertyId }] : []),
      buildCleaningStatsCleanerWhere(input.cleanerName ?? null),
    ],
  };
}

export function sortCleaningStatsGroups<T extends { cleanerName: string | null; count: number }>(groups: readonly T[]): T[] {
  return [...groups].sort((left, right) => (
    right.count - left.count
    || (left.cleanerName ?? "").localeCompare(right.cleanerName ?? "", "ko")
  ));
}
