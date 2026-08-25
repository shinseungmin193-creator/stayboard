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

    await tx.$executeRaw`
      UPDATE "CleaningTask" AS task
      SET
        "scheduledDate" = reservation."endDate",
        status = CASE
          WHEN task.status = 'CANCELLED'::"CleaningTaskStatus" THEN 'PENDING'::"CleaningTaskStatus"
          ELSE task.status
        END,
        "updatedAt" = NOW()
      FROM "Reservation" AS reservation
      WHERE task."reservationId" = reservation.id
        AND reservation."calendarSourceId" = ${input.calendarSourceId}
        AND reservation.status IN ('CONFIRMED'::"ReservationStatus", 'TENTATIVE'::"ReservationStatus")
        AND task."roomId" = ${input.roomId}
        AND task.status IN (
          'PENDING'::"CleaningTaskStatus",
          'IN_PROGRESS'::"CleaningTaskStatus",
          'CANCELLED'::"CleaningTaskStatus"
        )
        AND (task."scheduledDate" <> reservation."endDate" OR task.status = 'CANCELLED'::"CleaningTaskStatus")
    `;
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
