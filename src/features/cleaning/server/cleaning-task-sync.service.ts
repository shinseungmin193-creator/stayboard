import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { CANCELLABLE_CLEANING_TASK_STATUSES, isActiveCleaningReservationStatus } from "../domain/cleaning-task-sync-policy";

interface SyncCleaningTasksInput {
  calendarSourceId: string;
  companyId: string;
  propertyId: string;
  roomId: string;
}

export async function syncCleaningTasksForCalendarSource(
  tx: Prisma.TransactionClient,
  input: SyncCleaningTasksInput,
) {
  const reservations = await tx.reservation.findMany({
    where: { calendarSourceId: input.calendarSourceId },
    select: { id: true, status: true, endDate: true },
  });

  const activeReservations = reservations.filter((reservation) => isActiveCleaningReservationStatus(reservation.status));

  if (activeReservations.length) {
    await tx.cleaningTask.createMany({
      data: activeReservations.map((reservation) => ({
        companyId: input.companyId,
        propertyId: input.propertyId,
        roomId: input.roomId,
        reservationId: reservation.id,
        scheduledDate: reservation.endDate,
      })),
      skipDuplicates: true,
    });

    for (const reservation of activeReservations) {
      await tx.cleaningTask.updateMany({
        where: {
          reservationId: reservation.id,
          roomId: input.roomId,
          status: { in: [...CANCELLABLE_CLEANING_TASK_STATUSES] },
        },
        data: { scheduledDate: reservation.endDate },
      });
      await tx.cleaningTask.updateMany({
        where: { reservationId: reservation.id, roomId: input.roomId, status: "CANCELLED" },
        data: { status: "PENDING", scheduledDate: reservation.endDate },
      });
    }
  }

  const cancelledReservationIds = reservations
    .filter((reservation) => reservation.status === "CANCELLED")
    .map((reservation) => reservation.id);

  if (cancelledReservationIds.length) {
    await tx.cleaningTask.updateMany({
      where: {
        reservationId: { in: cancelledReservationIds },
        status: { in: [...CANCELLABLE_CLEANING_TASK_STATUSES] },
      },
      data: { status: "CANCELLED" },
    });
  }
}
