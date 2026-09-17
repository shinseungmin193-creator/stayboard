import "server-only";

import { prisma } from "@/lib/prisma";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";

export function listCalendarSourcesDueForAutomaticSync(input: {
  dueBefore: Date;
  limit: number;
}) {
  return prisma.calendarSource.findMany({
    where: {
      isActive: true,
      connectionStatus: "NORMAL",
      provider: { in: [...CALENDAR_PROVIDER_TYPES] },
      OR: [
        { lastSyncedAt: null },
        { lastSyncedAt: { lt: input.dueBefore } },
      ],
      room: {
        isActive: true,
        property: { isActive: true, company: { isActive: true } },
      },
    },
    select: { id: true, roomId: true, provider: true },
    orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: input.limit,
  });
}
