import "server-only";

import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import type { Prisma } from "@/lib/generated/prisma/client";
import { isSameReservationDate } from "@/features/reservations/reservation-date";

export const ACTIVE_CLEANING_TASK_STATUSES = ["PENDING", "IN_PROGRESS"] as const;
export const DASHBOARD_CLEANING_TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

type CleaningListTaskStatus = (typeof DASHBOARD_CLEANING_TASK_STATUSES)[number];

export function buildCheckoutCleaningTaskWhere(input: {
  start: Date;
  end: Date;
  roomWhere?: Prisma.RoomWhereInput;
  statuses: readonly (typeof DASHBOARD_CLEANING_TASK_STATUSES)[number][];
}): Prisma.CleaningTaskWhereInput {
  return {
    AND: [
      { status: { in: [...input.statuses] } },
      { scheduledDate: { gte: input.start, lt: input.end } },
      {
        room: {
          is: {
            AND: [
              input.roomWhere ?? {},
              { isActive: true, property: { isActive: true, company: { isActive: true } } },
            ],
          },
        },
      },
      {
        reservation: {
          is: {
            ...buildOperationalReservationWhere(),
            endDate: { gte: input.start, lt: input.end },
          },
        },
      },
    ],
  };
}

export function buildOperationalCleaningTaskWhere(input: {
  start: Date;
  end: Date;
  roomWhere?: Prisma.RoomWhereInput;
}): Prisma.CleaningTaskWhereInput {
  return buildCheckoutCleaningTaskWhere({ ...input, statuses: ACTIVE_CLEANING_TASK_STATUSES });
}

export function buildSelectedDateCleaningTaskWhere(input: {
  start: Date;
  end: Date;
  roomWhere?: Prisma.RoomWhereInput;
  statuses: readonly CleaningListTaskStatus[];
}): Prisma.CleaningTaskWhereInput {
  const operationalWhere = buildOperationalCleaningTaskWhere(input);
  const includeCompleted = input.statuses.includes("COMPLETED");

  return {
    AND: [
      { status: { in: [...input.statuses] } },
      includeCompleted
        ? {
            OR: [
              operationalWhere,
              {
                status: "COMPLETED",
                scheduledDate: { gte: input.start, lt: input.end },
                room: { is: input.roomWhere ?? {} },
              },
            ],
          }
        : operationalWhere,
    ],
  };
}

export function isCleaningTaskAlignedWithReservation(input: {
  scheduledDate: Date;
  reservation: { endDate: Date } | null;
}) {
  return Boolean(
    input.reservation
    && Number.isFinite(input.scheduledDate.getTime())
    && Number.isFinite(input.reservation.endDate.getTime())
    && isSameReservationDate(input.scheduledDate, input.reservation.endDate),
  );
}
