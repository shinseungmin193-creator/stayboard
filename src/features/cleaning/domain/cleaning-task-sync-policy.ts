export const ACTIVE_CLEANING_RESERVATION_STATUSES = ["CONFIRMED", "TENTATIVE"] as const;
export const CANCELLABLE_CLEANING_TASK_STATUSES = ["PENDING", "IN_PROGRESS"] as const;

export function isActiveCleaningReservationStatus(status: string) {
  return ACTIVE_CLEANING_RESERVATION_STATUSES.includes(status as (typeof ACTIVE_CLEANING_RESERVATION_STATUSES)[number]);
}

export function shouldCancelCleaningTask(reservationStatus: string, taskStatus: string) {
  return reservationStatus === "CANCELLED"
    && CANCELLABLE_CLEANING_TASK_STATUSES.includes(taskStatus as (typeof CANCELLABLE_CLEANING_TASK_STATUSES)[number]);
}
