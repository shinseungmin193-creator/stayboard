import type { Prisma } from "../../../lib/generated/prisma/client";
import { DEFAULT_TIMEZONE } from "../../../lib/constants";
import { getZonedDateInput, shiftDateInput } from "../../../lib/zoned-date";

export type CompletedCleaningHistoryGroupKind = "today" | "yesterday" | "date" | "unknown";

export interface CompletedCleaningHistoryGroup<T> {
  dateKey: string | null;
  kind: CompletedCleaningHistoryGroupKind;
  items: T[];
}

function completedAtTimestamp(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function groupCompletedCleaningHistory<T extends { id: string; completedAt: string | null }>(
  items: readonly T[],
  referenceAt: Date,
  timeZone = DEFAULT_TIMEZONE,
): CompletedCleaningHistoryGroup<T>[] {
  const today = getZonedDateInput(referenceAt, timeZone);
  const yesterday = shiftDateInput(today, -1);
  const grouped = new Map<string | null, T[]>();

  for (const item of items) {
    const completedAt = item.completedAt ? new Date(item.completedAt) : null;
    const dateKey = completedAt && !Number.isNaN(completedAt.getTime())
      ? getZonedDateInput(completedAt, timeZone)
      : null;
    const group = grouped.get(dateKey) ?? [];
    group.push(item);
    grouped.set(dateKey, group);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => {
      if (left === right) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return right.localeCompare(left);
    })
    .map(([dateKey, groupItems]) => ({
      dateKey,
      kind: dateKey === null ? "unknown" : dateKey === today ? "today" : dateKey === yesterday ? "yesterday" : "date",
      items: [...groupItems].sort((left, right) => (
        completedAtTimestamp(right.completedAt) - completedAtTimestamp(left.completedAt)
        || right.id.localeCompare(left.id)
      )),
    }));
}

export function buildCompletedCleaningHistoryWhere(input: {
  roomWhere?: Prisma.RoomWhereInput;
  companyId?: string | null;
  propertyId?: string | null;
  roomId?: string | null;
  assigneeId?: string | null;
}): Prisma.CleaningTaskWhereInput {
  return {
    AND: [
      input.roomWhere ? { room: { is: input.roomWhere } } : {},
      { status: "COMPLETED" },
      input.companyId ? { companyId: input.companyId } : {},
      input.propertyId ? { propertyId: input.propertyId } : {},
      input.roomId ? { roomId: input.roomId } : {},
      input.assigneeId && input.assigneeId !== "unassigned" ? { assignedToId: input.assigneeId } : {},
    ],
  };
}
