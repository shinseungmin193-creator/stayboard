import { addDays, differenceInCalendarDays } from "date-fns";
import type { CalendarProviderType, RoomOperationalStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import { getDashboardTodayRange } from "@/features/dashboard/dashboard-time";
import { buildRoomOperationalSchedule, calculateRoomOverviewStatus, isValidReservation, selectCurrentReservation, selectNextReservation, sortRoomOverviewCards, summarizeRoomOverview, type RoomOverviewCard, type RoomOverviewReservation, type RoomOverviewStatus } from "../domain/room-overview";
import { findRoomOverviewData, findUpcomingRoomOverviewConflicts } from "../infrastructure/room-overview.repository";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { AccessScope } from "@/features/access-control";
import type { CalendarRangeDays } from "../domain/room-overview-mobile";

export interface RoomOverviewFilters { propertyId?: string; query?: string; status?: RoomOverviewStatus; operationalStatus?: RoomOperationalStatus; provider?: CalendarProviderType; syncStatus?: SyncStatus; companyIds?: readonly string[]; accessScope?: AccessScope }

export async function listRoomOverview(filters: RoomOverviewFilters, now = new Date(), calendarRangeDays: CalendarRangeDays = 7) {
  const { start: todayStart, end: todayEnd } = getDashboardTodayRange(now);
  const rangeEnd = addDays(todayEnd, 7);
  const calendarStart = addDays(todayStart, -Math.floor(calendarRangeDays / 2));
  const calendarEnd = addDays(calendarStart, calendarRangeDays);
  const queryEnd = calendarEnd > rangeEnd ? calendarEnd : rangeEnd;
  const [rows, conflicts] = await Promise.all([
    findRoomOverviewData({ propertyId: filters.propertyId, operationalStatus: filters.operationalStatus, companyIds: filters.companyIds, accessScope: filters.accessScope, from: calendarStart, todayStart, toExclusive: queryEnd }),
    findUpcomingRoomOverviewConflicts({ propertyId: filters.propertyId, companyIds: filters.companyIds, accessScope: filters.accessScope, from: calendarStart, todayStart, toExclusive: queryEnd }),
  ]);

  const cards = sortRoomOverviewCards(rows.map((row): RoomOverviewCard => {
    const reservations: RoomOverviewReservation[] = row.reservations;
    const currentReservation = selectCurrentReservation(reservations, todayStart, todayEnd);
    const nextReservation = selectNextReservation(reservations, todayEnd);
    const syncs = row.calendarSources.flatMap((source) => source.syncLogs).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const syncStates = row.calendarSources.flatMap((source) => source.syncLogs.map((sync) => ({ ...sync, provider: source.provider })));
    return {
      id: row.id, propertyId: row.propertyId, propertyName: row.property.name, name: formatRoomDisplayName(row), code: row.code, sortOrder: row.sortOrder, operationalStatus: row.operationalStatus, operationalStatusUpdatedAt: row.operationalStatusUpdatedAt,
      status: calculateRoomOverviewStatus({ reservations, activeConflictCount: row.conflicts.length, todayStart, todayEnd }),
      currentReservation,
      nextReservation,
      nextReservationLeadDays: nextReservation ? Math.max(0, differenceInCalendarDays(nextReservation.startDate, todayStart)) : null,
      reservationCount: reservations.filter((item) => item.status !== "CANCELLED" && item.status !== "BLOCKED" && isValidReservation(item)).length,
      activeConflictCount: row.conflicts.length,
      providers: [...new Set(row.calendarSources.map((source) => source.provider))],
      latestSync: syncs[0] ?? null,
      syncStates,
      reservations,
    };
  }));

  const normalizedQuery = filters.query?.trim().toLocaleLowerCase("ko");
  const filteredCards = cards.filter((card) => {
    if (normalizedQuery && !`${card.code} ${card.name} ${card.propertyName}`.toLocaleLowerCase("ko").includes(normalizedQuery)) return false;
    if (filters.status && card.status !== filters.status) return false;
    if (filters.provider && !card.providers.includes(filters.provider)) return false;
    if (filters.syncStatus && !card.syncStates.some((sync) => sync.status === filters.syncStatus)) return false;
    return true;
  });

  const scheduleReservations = cards.flatMap((card) => card.reservations.filter((item) => item.status !== "CANCELLED" && item.status !== "BLOCKED" && isValidReservation(item)).map((item) => ({ ...item, roomId: card.id, roomName: card.name, hasConflict: card.activeConflictCount > 0 })));
  const operationalSchedule = buildRoomOperationalSchedule(scheduleReservations, todayStart, todayEnd, rangeEnd);
  return { cards: filteredCards, allCards: cards, summary: summarizeRoomOverview(cards), todayStart, todayEnd, rangeEnd, calendarStart, calendarEnd, operationalSchedule, conflicts };
}
