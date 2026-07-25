import "server-only";

import { addDays, differenceInCalendarDays } from "date-fns";
import type { ConflictFilters, ConflictListItem } from "@/features/reservation-conflicts/reservation-conflict.types";
import type { RoomStatusRoom } from "@/features/room-status/room-status.types";
import type { OccupancyPeriod, OccupancyRoom } from "@/features/statistics/occupancy/domain/occupancy";
import { calculateOccupancyMetrics } from "@/features/statistics/occupancy/domain/occupancy";
import { summarizeDashboardCleaning } from "@/features/dashboard/dashboard-cleaning";
import { buildRoomOperationalSchedule, calculateRoomOverviewStatus, selectCurrentReservation, selectNextReservation, sortRoomOverviewCards, summarizeRoomOverview, type RoomOperationalScheduleReservation, type RoomOverviewCard, type RoomOverviewFilters, type RoomOverviewReservation } from "@/features/room-overview";
import { DEMO_PROPERTY, createDemoFixtures } from "../data/demo-fixtures";

export const DEMO_PROPERTY_OPTIONS = [{ ...DEMO_PROPERTY }];
export const DEMO_ROOM_OPTIONS = ["101", "102", "201", "202"].map((number) => ({ id: `demo-room-${number}`, name: `${number}호`, propertyId: DEMO_PROPERTY.id, propertyName: DEMO_PROPERTY.name, isActive: true, propertyIsActive: true }));

function buildDemoCards(now = new Date()) {
  const fixture = createDemoFixtures(now);
  const cards = fixture.rooms.map((room): RoomOverviewCard => {
    const reservations: RoomOverviewReservation[] = fixture.reservations.filter((item) => item.roomId === room.id);
    const currentReservation = selectCurrentReservation(reservations, fixture.start, fixture.end);
    const nextReservation = selectNextReservation(reservations, fixture.end);
    const activeConflictCount = room.id === "demo-room-201" ? 1 : 0;
    return {
      ...room,
      propertyName: DEMO_PROPERTY.name,
      operationalStatusUpdatedAt: null,
      status: calculateRoomOverviewStatus({ reservations, activeConflictCount, todayStart: fixture.start, todayEnd: fixture.end }),
      currentReservation,
      nextReservation,
      nextReservationLeadDays: nextReservation ? differenceInCalendarDays(nextReservation.startDate, fixture.start) : null,
      reservationCount: reservations.length,
      activeConflictCount,
      providers: ["AIRBNB", "BOOKING", "AGODA"],
      latestSync: { status: "SUCCESS", startedAt: new Date(now.getTime() - 5 * 60 * 1000), completedAt: new Date(now.getTime() - 4 * 60 * 1000) },
      syncStates: [{ provider: "AIRBNB", status: "SUCCESS", startedAt: new Date(now.getTime() - 5 * 60 * 1000), completedAt: new Date(now.getTime() - 4 * 60 * 1000) }],
      reservations,
    };
  });
  return { ...fixture, cards: sortRoomOverviewCards(cards) };
}

export function getDemoRoomOverview(filters: RoomOverviewFilters, now = new Date()) {
  const fixture = buildDemoCards(now);
  const query = filters.query?.trim().toLocaleLowerCase("ko");
  const cards = fixture.cards.filter((card) => {
    if (filters.propertyId && card.propertyId !== filters.propertyId) return false;
    if (query && !`${card.name} ${card.propertyName}`.toLocaleLowerCase("ko").includes(query)) return false;
    if (filters.status && card.status !== filters.status) return false;
    if (filters.operationalStatus && card.operationalStatus !== filters.operationalStatus) return false;
    if (filters.provider && !card.providers.includes(filters.provider)) return false;
    if (filters.syncStatus && !card.syncStates.some((item) => item.status === filters.syncStatus)) return false;
    return true;
  });
  const scheduleReservations: RoomOperationalScheduleReservation[] = fixture.cards.flatMap((card) => card.reservations.map((item) => ({ ...item, roomId: card.id, roomName: card.name, hasConflict: card.activeConflictCount > 0 })));
  const rangeEnd = addDays(fixture.end, 7);
  const conflictReservations = fixture.reservations.filter((item) => item.roomId === "demo-room-201");
  const conflicts = [{ id: "demo-conflict-1", overlapStart: conflictReservations[1].startDate, overlapEnd: conflictReservations[0].endDate, room: { id: "demo-room-201", name: "201호" }, reservationA: conflictReservations[0], reservationB: conflictReservations[1] }];
  return { cards, allCards: fixture.cards, summary: summarizeRoomOverview(fixture.cards), todayStart: fixture.start, todayEnd: fixture.end, rangeEnd, operationalSchedule: buildRoomOperationalSchedule(scheduleReservations, fixture.start, fixture.end, rangeEnd), conflicts };
}

export function getDemoDashboardData(now = new Date()) {
  const overview = getDemoRoomOverview({}, now);
  const cleaning = summarizeDashboardCleaning(overview.allCards, overview.todayStart, overview.todayEnd);
  return { todayCheckIns: overview.summary.statuses.CHECK_IN_TODAY, todayCheckOuts: overview.summary.statuses.CHECK_OUT_TODAY, registeredRooms: overview.summary.total, activeConflicts: overview.summary.statuses.CONFLICT, conflictedCheckIns: 0, recentSyncFailures: 0, latestSync: { status: "SUCCESS" as const, completedAt: new Date(now.getTime() - 4 * 60 * 1000) }, recentFailureHours: 24, priorityCleaning: cleaning.priority, flexibleCleaning: cleaning.flexible, priorityCleaningRooms: cleaning.priorityRooms, flexibleCleaningRooms: cleaning.flexibleRooms };
}

export function getDemoRoomStatusData(now = new Date()): RoomStatusRoom[] {
  const fixture = createDemoFixtures(now);
  return fixture.rooms.map((room) => ({ id: room.id, name: room.name, propertyId: room.propertyId, propertyName: DEMO_PROPERTY.name, sources: [{ id: `${room.id}-airbnb`, name: `${room.name} Airbnb`, provider: "AIRBNB" }], reservations: fixture.reservations.filter((item) => item.roomId === room.id).map((item) => ({ ...item, hasActiveConflict: room.id === "demo-room-201" })) }));
}

export function getDemoConflicts(filters: ConflictFilters) {
  const fixture = createDemoFixtures();
  const reservations = fixture.reservations.filter((item) => item.roomId === "demo-room-201");
  const item: ConflictListItem = { id: "demo-conflict-1", status: "ACTIVE", overlapStart: reservations[1].startDate, overlapEnd: reservations[0].endDate, detectedAt: fixture.start, roomName: "201호", propertyName: DEMO_PROPERTY.name, reservationA: reservations[0], reservationB: reservations[1] };
  const visible = filters.status === "ACTIVE" && item.overlapStart < filters.toExclusive && item.overlapEnd > filters.from && (!filters.propertyId || filters.propertyId === DEMO_PROPERTY.id) && (!filters.roomId || filters.roomId === "demo-room-201") && (!filters.provider || item.reservationA.provider === filters.provider || item.reservationB.provider === filters.provider);
  return { items: visible ? [item] : [], totalCount: visible ? 1 : 0, totalPages: 1, page: 1 };
}

export function getDemoOccupancyData(period: OccupancyPeriod, query?: string) {
  const fixture = createDemoFixtures();
  const normalizedQuery = query?.trim().toLocaleLowerCase("ko");
  const rooms: OccupancyRoom[] = fixture.rooms.filter((room) => !normalizedQuery || `${room.name} ${DEMO_PROPERTY.name}`.toLocaleLowerCase("ko").includes(normalizedQuery)).map((room) => ({ id: room.id, propertyId: room.propertyId, propertyName: DEMO_PROPERTY.name, name: room.name, sortOrder: room.sortOrder, activeConflictCount: room.id === "demo-room-201" ? 1 : 0, reservations: fixture.reservations.filter((item) => item.roomId === room.id).map(({ status, startDate, endDate }) => ({ status, startDate, endDate })) }));
  const metric = calculateOccupancyMetrics(rooms, period);
  return { metric, emptyReason: rooms.length ? null : "FILTERED" as const };
}
