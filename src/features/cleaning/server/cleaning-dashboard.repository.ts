import "server-only";

import type { AccessScope } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control";
import { summarizeDashboardCleaningTasks } from "@/features/dashboard/dashboard-cleaning";
import { prisma } from "@/lib/prisma";
import { buildCheckoutCleaningTaskWhere, DASHBOARD_CLEANING_TASK_STATUSES } from "./cleaning-task-query";
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
    where: buildCheckoutCleaningTaskWhere({
      start: input.start,
      end: input.end,
      roomWhere: scopedRoom,
      statuses: DASHBOARD_CLEANING_TASK_STATUSES,
    }),
    select: {
      id: true,
      scheduledDate: true,
      status: true,
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

  return summarizeDashboardCleaningTasks(tasks, input.start, input.end);
}
