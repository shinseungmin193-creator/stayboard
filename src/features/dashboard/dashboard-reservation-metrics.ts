import { calculateOverlapRange, doReservationRangesOverlap } from "../reservation-conflicts/domain/reservation-conflict";
import { getReservationOperationalDay, type RoomOverviewReservation } from "../room-overview/domain/room-overview";

type DashboardReservation = Omit<RoomOverviewReservation, "activeConflicts">;

export interface DashboardRoomReservationRow {
  id: string;
  reservations: DashboardReservation[];
}

export interface DashboardConflictReservation {
  id: string;
  roomId: string;
  status: RoomOverviewReservation["status"];
  startDate: Date;
  endDate: Date;
}

export interface DashboardConflictRow {
  id: string;
  roomId: string;
  overlapStart: Date;
  overlapEnd: Date;
  reservationA: DashboardConflictReservation;
  reservationB: DashboardConflictReservation;
}

export function summarizeDashboardReservationMetrics(input: {
  rooms: readonly DashboardRoomReservationRow[];
  conflicts: readonly DashboardConflictRow[];
  todayStart: Date;
  todayEnd: Date;
  roomOverviewConflictStart: Date;
  roomOverviewConflictEnd: Date;
}) {
  const conflictedRoomIds = new Set(input.conflicts.flatMap((conflict) => {
    if (conflict.overlapEnd <= input.roomOverviewConflictStart) return [];
    if (conflict.overlapStart >= input.roomOverviewConflictEnd) return [];
    if (!doReservationRangesOverlap(conflict.reservationA, conflict.reservationB)) return [];
    const overlap = calculateOverlapRange(conflict.reservationA, conflict.reservationB);
    return overlap && overlap.overlapEnd > input.todayStart ? [conflict.roomId] : [];
  }));

  let todayCheckIns = 0;
  let todayCheckOuts = 0;
  let conflictedCheckIns = 0;

  for (const room of input.rooms) {
    let roomHasTodayCheckIn = false;
    for (const reservation of room.reservations) {
      const operationalDay = getReservationOperationalDay(
        { ...reservation, activeConflicts: [] },
        input.todayStart,
        input.todayEnd,
      );
      if (operationalDay.isTodayCheckIn) {
        todayCheckIns += 1;
        roomHasTodayCheckIn = true;
      }
      if (operationalDay.isTodayCheckOut) todayCheckOuts += 1;
    }
    if (roomHasTodayCheckIn && conflictedRoomIds.has(room.id)) conflictedCheckIns += 1;
  }

  return {
    registeredRooms: input.rooms.length,
    todayCheckIns,
    todayCheckOuts,
    activeConflicts: input.conflicts.filter((conflict) => conflict.overlapEnd >= input.todayStart).length,
    conflictedCheckIns,
  };
}
