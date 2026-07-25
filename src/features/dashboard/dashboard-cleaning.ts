import type { RoomOverviewCard, RoomOverviewReservation } from "@/features/room-overview/domain/room-overview";

const ACTIVE_RESERVATION_STATUSES = new Set(["CONFIRMED", "TENTATIVE"]);

function isActiveReservation(reservation: RoomOverviewReservation) {
  return ACTIVE_RESERVATION_STATUSES.has(reservation.status)
    && Number.isFinite(reservation.startDate.getTime())
    && Number.isFinite(reservation.endDate.getTime())
    && reservation.startDate < reservation.endDate;
}

type DashboardCleaningRoom = Pick<RoomOverviewCard, "id" | "name" | "propertyName" | "reservations">;

export function summarizeDashboardCleaning(rooms: readonly DashboardCleaningRoom[], todayStart: Date, todayEnd: Date) {
  const priorityRooms: Array<Pick<DashboardCleaningRoom, "id" | "name" | "propertyName">> = [];
  const flexibleRooms: Array<Pick<DashboardCleaningRoom, "id" | "name" | "propertyName">> = [];
  for (const room of rooms) {
    const reservations = room.reservations.filter(isActiveReservation);
    const hasCheckout = reservations.some((reservation) => reservation.endDate > todayStart && reservation.endDate <= todayEnd);
    if (!hasCheckout) continue;
    const hasCheckIn = reservations.some((reservation) => reservation.startDate >= todayStart && reservation.startDate < todayEnd);
    const item = { id: room.id, name: room.name, propertyName: room.propertyName };
    if (hasCheckIn) priorityRooms.push(item);
    else flexibleRooms.push(item);
  }
  return { priority: priorityRooms.length, flexible: flexibleRooms.length, priorityRooms, flexibleRooms };
}
