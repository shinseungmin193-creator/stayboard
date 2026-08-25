import type { RoomOverviewCard, RoomOverviewReservation } from "@/features/room-overview/domain/room-overview";
import { classifyCleaningPriority } from "../cleaning/domain/cleaning-priority";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "../reservations/reservation.constants";

const ACTIVE_RESERVATION_STATUSES = new Set<string>(ACTIVE_OTA_RESERVATION_STATUSES);

function isActiveReservation(reservation: RoomOverviewReservation) {
  return ACTIVE_RESERVATION_STATUSES.has(reservation.status)
    && Number.isFinite(reservation.startDate.getTime())
    && Number.isFinite(reservation.endDate.getTime())
    && reservation.startDate < reservation.endDate;
}

type DashboardCleaningRoom = Pick<RoomOverviewCard, "id" | "name" | "propertyName" | "reservations">;

export type DashboardCleaningTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface DashboardCleaningTask {
  id: string;
  scheduledDate: Date;
  status: DashboardCleaningTaskStatus;
  reservation: { endDate: Date } | null;
  room: {
    id: string;
    name: string;
    property: { name: string };
    reservations: Array<{ startDate: Date }>;
  };
}

function isCleaningTaskAlignedWithReservation(task: DashboardCleaningTask) {
  return Boolean(
    task.reservation
    && Number.isFinite(task.scheduledDate.getTime())
    && Number.isFinite(task.reservation.endDate.getTime())
    && task.scheduledDate.getTime() === task.reservation.endDate.getTime(),
  );
}

export function summarizeDashboardCleaningTasks(
  tasks: readonly DashboardCleaningTask[],
  todayStart: Date,
  todayEnd: Date,
) {
  const priorityRooms: Array<{ id: string; name: string; propertyName: string }> = [];
  const flexibleRooms: Array<{ id: string; name: string; propertyName: string }> = [];
  const completedRooms: Array<{ id: string; name: string; propertyName: string }> = [];

  for (const task of tasks) {
    if (!isCleaningTaskAlignedWithReservation(task)) continue;
    const item = { id: task.id, name: task.room.name, propertyName: task.room.property.name };
    if (task.status === "COMPLETED") {
      completedRooms.push(item);
      continue;
    }
    if (task.status !== "PENDING" && task.status !== "IN_PROGRESS") continue;

    const priority = classifyCleaningPriority(
      task.scheduledDate,
      task.room.reservations.map((reservation) => reservation.startDate),
      todayStart,
      todayEnd,
    );
    if (priority === "urgent") priorityRooms.push(item);
    else if (priority === "flexible") flexibleRooms.push(item);
  }

  const priority = priorityRooms.length;
  const flexible = flexibleRooms.length;
  const active = priority + flexible;
  const completed = completedRooms.length;
  return {
    total: active + completed,
    active,
    completed,
    priority,
    flexible,
    priorityRooms,
    flexibleRooms,
    completedRooms,
  };
}

export function summarizeDashboardCleaning(rooms: readonly DashboardCleaningRoom[], todayStart: Date, todayEnd: Date) {
  const priorityRooms: Array<Pick<DashboardCleaningRoom, "id" | "name" | "propertyName">> = [];
  const flexibleRooms: Array<Pick<DashboardCleaningRoom, "id" | "name" | "propertyName">> = [];
  for (const room of rooms) {
    const reservations = room.reservations.filter(isActiveReservation);
    const checkouts = reservations.filter((reservation) => reservation.endDate > todayStart && reservation.endDate <= todayEnd);
    for (const checkout of checkouts) {
      const priority = classifyCleaningPriority(checkout.endDate, reservations.map((reservation) => reservation.startDate), todayStart, todayEnd);
      const item = { id: `${room.id}:${checkout.id}`, name: room.name, propertyName: room.propertyName };
      if (priority === "urgent") priorityRooms.push(item);
      else flexibleRooms.push(item);
    }
  }
  return { priority: priorityRooms.length, flexible: flexibleRooms.length, priorityRooms, flexibleRooms };
}
