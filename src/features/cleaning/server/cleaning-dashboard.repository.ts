import "server-only";

import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import { classifyCleaningPriority } from "../domain/cleaning-priority";
import { buildOperationalCleaningTaskWhere, isCleaningTaskAlignedWithReservation } from "./cleaning-task-query";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";

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
    where: buildOperationalCleaningTaskWhere({ start: input.start, end: input.end, roomWhere: scopedRoom }),
    select: {
      id: true,
      scheduledDate: true,
      reservation: { select: { endDate: true } },
      room: {
        select: {
          id: true,
          name: true,
          property: { select: { name: true } },
          reservations: {
            where: {
              ...buildOperationalReservationWhere(),
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
  for (const task of tasks.filter(isCleaningTaskAlignedWithReservation)) {
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
