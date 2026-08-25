import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";

export interface CalendarSourceReservationRemovalResult {
  reservationCount: number;
  conflictCount: number;
  cleaningTaskCount: number;
  deletedCleaningTaskCount: number;
  cancelledCleaningTaskCount: number;
  detachedCleaningTaskCount: number;
}

/**
 * Removes reservations owned by exactly one CalendarSource and keeps derived
 * cleaning history out of operational queues. Completed or otherwise audited
 * cleaning tasks are retained without their deleted reservation relation.
 */
export async function removeCalendarSourceReservations(
  tx: Prisma.TransactionClient,
  input: { calendarSourceId: string; reservationIds?: readonly string[] },
): Promise<CalendarSourceReservationRemovalResult> {
  const reservations = await tx.reservation.findMany({
    where: {
      calendarSourceId: input.calendarSourceId,
      ...(input.reservationIds ? { id: { in: [...input.reservationIds] } } : {}),
    },
    select: { id: true },
  });
  const reservationIds = reservations.map((reservation) => reservation.id);
  if (!reservationIds.length) {
    return {
      reservationCount: 0,
      conflictCount: 0,
      cleaningTaskCount: 0,
      deletedCleaningTaskCount: 0,
      cancelledCleaningTaskCount: 0,
      detachedCleaningTaskCount: 0,
    };
  }

  const [conflictCount, cleaningTasks] = await Promise.all([
    tx.reservationConflict.count({
      where: {
        OR: [
          { reservationAId: { in: reservationIds } },
          { reservationBId: { in: reservationIds } },
        ],
      },
    }),
    tx.cleaningTask.findMany({
      where: { reservationId: { in: reservationIds } },
      select: {
        id: true,
        status: true,
        assignedAt: true,
        startedAt: true,
        completedAt: true,
        note: true,
        _count: { select: { logs: true, photos: true } },
      },
    }),
  ]);

  const disposableTaskIds = cleaningTasks
    .filter((task) => (
      task.status === "PENDING"
      && !task.assignedAt
      && !task.startedAt
      && !task.completedAt
      && !task.note
      && task._count.logs === 0
      && task._count.photos === 0
    ))
    .map((task) => task.id);
  const disposableTaskIdSet = new Set(disposableTaskIds);
  const cancellableTaskIds = cleaningTasks
    .filter((task) => task.status === "PENDING" || task.status === "IN_PROGRESS")
    .map((task) => task.id)
    .filter((id) => !disposableTaskIdSet.has(id));
  const cancellableTaskIdSet = new Set(cancellableTaskIds);
  const retainedTaskIds = cleaningTasks
    .map((task) => task.id)
    .filter((id) => !disposableTaskIdSet.has(id));

  await tx.reservationConflict.deleteMany({
    where: {
      OR: [
        { reservationAId: { in: reservationIds } },
        { reservationBId: { in: reservationIds } },
      ],
    },
  });
  if (disposableTaskIds.length) {
    await tx.cleaningTask.deleteMany({ where: { id: { in: disposableTaskIds } } });
  }
  if (cancellableTaskIds.length) {
    await tx.cleaningTask.updateMany({
      where: { id: { in: cancellableTaskIds } },
      data: { status: "CANCELLED", reservationId: null },
    });
  }
  const historyOnlyTaskIds = retainedTaskIds.filter((id) => !cancellableTaskIdSet.has(id));
  if (historyOnlyTaskIds.length) {
    await tx.cleaningTask.updateMany({
      where: { id: { in: historyOnlyTaskIds } },
      data: { reservationId: null },
    });
  }
  const deletedReservations = await tx.reservation.deleteMany({
    where: { id: { in: reservationIds }, calendarSourceId: input.calendarSourceId },
  });

  return {
    reservationCount: deletedReservations.count,
    conflictCount,
    cleaningTaskCount: cleaningTasks.length,
    deletedCleaningTaskCount: disposableTaskIds.length,
    cancelledCleaningTaskCount: cancellableTaskIds.length,
    detachedCleaningTaskCount: retainedTaskIds.length,
  };
}
