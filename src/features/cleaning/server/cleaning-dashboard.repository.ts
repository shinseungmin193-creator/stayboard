import "server-only";

import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import { classifyCleaningPriority } from "../domain/cleaning-priority";

export async function getCleaningDashboardSummary(input: {
  start: Date;
  end: Date;
  companyIds?: readonly string[];
  accessScope?: AccessScope;
}) {
  const scopedRoom = roomScopeWhere(input.accessScope) ?? (input.companyIds
    ? { property: { companyId: { in: [...input.companyIds] } } }
    : {});
  const tasks = await prisma.cleaningTask.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      scheduledDate: { gt: input.start, lte: input.end },
      room: { is: scopedRoom },
    },
    select: {
      id: true,
      scheduledDate: true,
      room: {
        select: {
          id: true,
          name: true,
          property: { select: { name: true } },
          reservations: {
            where: {
              status: { in: ["CONFIRMED", "TENTATIVE"] },
              startDate: { gte: input.start, lt: input.end },
            },
            select: { startDate: true },
          },
        },
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
  });

  const priorityRooms: Array<{ id: string; name: string; propertyName: string }> = [];
  const flexibleRooms: Array<{ id: string; name: string; propertyName: string }> = [];
  for (const task of tasks) {
    const item = { id: task.room.id, name: task.room.name, propertyName: task.room.property.name };
    const priority = classifyCleaningPriority(
      task.scheduledDate,
      task.room.reservations.map((reservation) => reservation.startDate),
      input.start,
      input.end,
    );
    if (priority === "urgent") priorityRooms.push(item);
    else flexibleRooms.push(item);
  }
  return {
    priority: priorityRooms.length,
    flexible: flexibleRooms.length,
    priorityRooms,
    flexibleRooms,
  };
}
