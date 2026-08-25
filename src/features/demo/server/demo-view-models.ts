import "server-only";

import { addDays, differenceInCalendarDays } from "date-fns";
import type { ConflictFilters, ConflictListItem } from "@/features/reservation-conflicts/reservation-conflict.types";
import type { ReservationFilters, ReservationListItem } from "@/features/reservations";
import { getReservationDisplayStatus } from "@/features/reservations";
import { RESERVATION_PAGE_SIZE } from "@/features/reservations/reservation.constants";
import { isActiveReservationListItem } from "@/features/reservations/reservation-list-policy";
import type { RoomStatusRoom } from "@/features/room-status/room-status.types";
import { isReservationVisibleInRoomStatusRange, type RoomStatusCalendarRange } from "@/features/room-status/room-status-calendar";
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
  const activeCleaning = cleaning.priority + cleaning.flexible;
  return { todayCheckIns: overview.summary.statuses.CHECK_IN_TODAY, todayCheckOuts: overview.summary.statuses.CHECK_OUT_TODAY, registeredRooms: overview.summary.total, activeConflicts: overview.summary.statuses.CONFLICT, conflictedCheckIns: 0, recentSyncFailures: 0, latestSync: { status: "SUCCESS" as const, completedAt: new Date(now.getTime() - 4 * 60 * 1000) }, recentFailureHours: 24, priorityCleaning: cleaning.priority, flexibleCleaning: cleaning.flexible, completedCleaning: 0, activeCleaning, totalCleaning: activeCleaning, priorityCleaningRooms: cleaning.priorityRooms, flexibleCleaningRooms: cleaning.flexibleRooms, completedCleaningRooms: [] };
}

export function getDemoRoomStatusData(range: RoomStatusCalendarRange): RoomStatusRoom[] {
  const fixture = createDemoFixtures(range.rangeStart);
  return fixture.rooms.map((room) => ({ id: room.id, name: room.name, propertyId: room.propertyId, propertyName: DEMO_PROPERTY.name, sources: [{ id: `${room.id}-airbnb`, name: `${room.name} Airbnb`, provider: "AIRBNB" }], reservations: fixture.reservations.filter((item) => item.roomId === room.id && isReservationVisibleInRoomStatusRange(item, range)).map((item) => ({ ...item, providerReservationId: null, hasActiveConflict: room.id === "demo-room-201" })) }));
}

export function getDemoConflicts(filters: ConflictFilters) {
  const fixture = createDemoFixtures();
  const reservations = fixture.reservations.filter((item) => item.roomId === "demo-room-201");
  const overlapEnd = reservations[0].endDate;
  const item: ConflictListItem = { id: "demo-conflict-1", status: "ACTIVE", overlapStart: reservations[1].startDate, overlapEnd, detectedAt: fixture.start, isPast: overlapEnd < filters.todayStart, roomName: "201호", propertyName: DEMO_PROPERTY.name, reservationA: reservations[0], reservationB: reservations[1] };
  const scopeMatches = item.overlapStart < filters.toExclusive && item.overlapEnd > filters.from && (!filters.propertyId || filters.propertyId === DEMO_PROPERTY.id) && (!filters.roomId || filters.roomId === "demo-room-201") && (!filters.provider || item.reservationA.provider === filters.provider || item.reservationB.provider === filters.provider);
  const statusMatches = filters.status === "ALL" || filters.status === "ACTIVE" || (filters.status === "PAST" && item.isPast);
  const visible = scopeMatches && statusMatches;
  const dismissibleCount = scopeMatches && item.isPast ? 1 : 0;
  return { items: visible ? [item] : [], totalCount: visible ? 1 : 0, totalPages: 1, page: 1, dismissibleCount };
}

export function getDemoReservations(filters: ReservationFilters) {
  const fixture = createDemoFixtures(filters.businessDate);
  const roomById = new Map(fixture.rooms.map((room) => [room.id, room]));
  const items: ReservationListItem[] = fixture.reservations.map((reservation, index) => {
    const room = roomById.get(reservation.roomId)!;
    const conflictReservations = reservation.roomId === "demo-room-201"
      ? fixture.reservations.filter((item) => item.roomId === reservation.roomId && item.id !== reservation.id)
      : [];
    return {
      id: reservation.id,
      guestName: reservation.guestName,
      providerReservationId: `DEMO-${reservation.provider}-${index + 1}`,
      summary: reservation.summary,
      description: null,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      provider: reservation.provider,
      status: reservation.status,
      propertyId: DEMO_PROPERTY.id,
      propertyName: DEMO_PROPERTY.name,
      roomId: reservation.roomId,
      roomName: room.name,
      calendarSourceName: reservation.calendarSourceName,
      latestSyncStatus: "SUCCESS",
      latestSyncCompletedAt: addDays(fixture.start, -1),
      providerCreatedAt: addDays(reservation.startDate, -14),
      providerUpdatedAt: addDays(reservation.startDate, -3),
      createdAt: addDays(reservation.startDate, -14),
      updatedAt: addDays(reservation.startDate, -3),
      activeConflictCount: conflictReservations.length,
      activeConflicts: conflictReservations.map((other) => ({
        id: other.id,
        guestName: other.guestName,
        startDate: other.startDate,
        endDate: other.endDate,
        provider: other.provider,
        status: other.status,
        calendarSourceName: other.calendarSourceName,
      })),
    };
  });
  const search = filters.search?.trim().toLocaleLowerCase("ko");
  const visible = items.filter((item) => {
    if (filters.propertyId && item.propertyId !== filters.propertyId) return false;
    if (filters.roomId && item.roomId !== filters.roomId) return false;
    if (filters.providers?.length && !filters.providers.includes(item.provider)) return false;
    if (!filters.dateMode && !isActiveReservationListItem({ reservationStatus: item.status, endDate: item.endDate, businessDate: filters.businessDate })) return false;
    if (filters.dateMode && item.status !== "CONFIRMED" && item.status !== "TENTATIVE") return false;
    const displayStatus = getReservationDisplayStatus({ reservationStatus: item.status, startDate: item.startDate, endDate: item.endDate, businessDate: filters.businessDate });
    if (filters.displayStatuses?.length && !filters.displayStatuses.some((status) => status === displayStatus)) return false;
    if (filters.hasConflict !== undefined && Boolean(item.activeConflictCount) !== filters.hasConflict) return false;
    if (filters.dateField === "checkIn" && !(item.startDate >= filters.from && item.startDate < filters.toExclusive)) return false;
    if (filters.dateField === "checkOut" && !(item.endDate >= filters.from && item.endDate < filters.toExclusive)) return false;
    if ((!filters.dateField || filters.dateField === "stay") && !(item.startDate < filters.toExclusive && item.endDate >= filters.from)) return false;
    if (search && !`${item.id} ${item.guestName ?? ""} ${item.providerReservationId ?? ""} ${item.roomName} ${item.propertyName}`.toLocaleLowerCase("ko").includes(search)) return false;
    return true;
  });
  const totalCount = visible.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / RESERVATION_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  return {
    items: visible.slice((page - 1) * RESERVATION_PAGE_SIZE, page * RESERVATION_PAGE_SIZE),
    totalCount,
    totalPages,
    page,
  };
}

export function getDemoOccupancyData(period: OccupancyPeriod, query?: string) {
  const fixture = createDemoFixtures();
  const normalizedQuery = query?.trim().toLocaleLowerCase("ko");
  const rooms: OccupancyRoom[] = fixture.rooms.filter((room) => !normalizedQuery || `${room.name} ${DEMO_PROPERTY.name}`.toLocaleLowerCase("ko").includes(normalizedQuery)).map((room) => ({ id: room.id, propertyId: room.propertyId, propertyName: DEMO_PROPERTY.name, name: room.name, sortOrder: room.sortOrder, activeConflictCount: room.id === "demo-room-201" ? 1 : 0, reservations: fixture.reservations.filter((item) => item.roomId === room.id).map(({ status, startDate, endDate }) => ({ status, startDate, endDate })) }));
  const metric = calculateOccupancyMetrics(rooms, period);
  return { metric, emptyReason: rooms.length ? null : "FILTERED" as const };
}
