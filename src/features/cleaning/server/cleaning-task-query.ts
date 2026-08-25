import "server-only";

import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import type { Prisma } from "@/lib/generated/prisma/client";

export const ACTIVE_CLEANING_TASK_STATUSES = ["PENDING", "IN_PROGRESS"] as const;

export function buildOperationalCleaningTaskWhere(input: {
  start: Date;
  end: Date;
  roomWhere?: Prisma.RoomWhereInput;
}): Prisma.CleaningTaskWhereInput {
  return {
    AND: [
      { status: { in: [...ACTIVE_CLEANING_TASK_STATUSES] } },
      { scheduledDate: { gt: input.start, lte: input.end } },
      {
        room: {
          is: {
            AND: [
              input.roomWhere ?? {},
              { isActive: true, property: { isActive: true } },
            ],
          },
        },
      },
      {
        reservation: {
          is: {
            ...buildOperationalReservationWhere(),
            endDate: { gt: input.start, lte: input.end },
          },
        },
      },
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
    && input.scheduledDate.getTime() === input.reservation.endDate.getTime(),
  );
}

