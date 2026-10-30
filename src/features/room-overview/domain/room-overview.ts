import type { CalendarProviderType, CleaningTaskStatus, ReservationStatus, RoomOperationalStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import { getReservationDisplayName } from "../../reservations/reservation-display";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "../../reservations/reservation.constants";
import type { ReservationConflictPeer } from "../../reservation-conflicts/domain/reservation-conflict";
import {
  getReservationDateOrdinal,
  isReservationCheckInOnDate,
  isReservationCheckOutOnDate,
  isReservationOccupiedOnDate,
  isValidReservationDateRange,
} from "../../reservations/reservation-date";

export type RoomReservationState = "VACANT" | "CHECK_IN_TODAY" | "OCCUPIED" | "CHECK_OUT_TODAY" | "CONFLICT";
export type RoomOverviewStatus = RoomReservationState;
export type RoomOverviewCleaningStatus = "NONE" | "INCOMPLETE" | "COMPLETED";
export type RoomOverviewCleaningFilter = Exclude<RoomOverviewCleaningStatus, "NONE">;
export type RoomInspectionStatus = "NONE" | "INCOMPLETE" | "READ" | "IN_PROGRESS" | "COMPLETED";

export const ROOM_OVERVIEW_STATUS_PRIORITY = ["CONFLICT", "CHECK_OUT_TODAY", "CHECK_IN_TODAY", "OCCUPIED", "VACANT"] as const satisfies readonly RoomReservationState[];

export const ROOM_OVERVIEW_STATUS_META = {
  VACANT: { labelKey: "roomStatus.VACANT" },
  CHECK_IN_TODAY: { labelKey: "roomStatus.CHECK_IN_TODAY" },
  OCCUPIED: { labelKey: "roomStatus.OCCUPIED" },
  CHECK_OUT_TODAY: { labelKey: "roomStatus.CHECK_OUT_TODAY" },
  CONFLICT: { labelKey: "roomStatus.CONFLICT" },
} as const satisfies Record<RoomReservationState, { labelKey: `roomStatus.${RoomReservationState}` }>;

export function getRoomOverviewStatusLabel(
  status: RoomReservationState,
  translate: (key: `roomStatus.${RoomReservationState}`) => string,
) {
  return translate(ROOM_OVERVIEW_STATUS_META[status].labelKey);
}

export interface RoomOverviewReservation {
  id: string;
  providerReservationId?: string | null;
  calendarSourceId?: string;
  guestName: string | null;
  provider: CalendarProviderType;
  status: ReservationStatus;
  startDate: Date;
  endDate: Date;
  activeConflicts: ReservationConflictPeer[];
}

export interface RoomOverviewCard {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;
  code: string;
  sortOrder: number;
  operationalStatus: RoomOperationalStatus;
  operationalStatusUpdatedAt: Date | null;
  status: RoomOverviewStatus;
  currentReservation: RoomOverviewReservation | null;
  nextReservation: RoomOverviewReservation | null;
  nextReservationLeadDays: number | null;
  reservationCount: number;
  activeConflictCount: number;
  pendingMemoCount: number;
  inspectionStatus: RoomInspectionStatus;
  cleaningStatus: RoomOverviewCleaningStatus;
  providers: CalendarProviderType[];
  latestSync: { status: SyncStatus; startedAt: Date; completedAt: Date | null } | null;
  syncStates: Array<{ provider: CalendarProviderType; status: SyncStatus; startedAt: Date; completedAt: Date | null }>;
  reservations: RoomOverviewReservation[];
}

export interface RoomOverviewPropertyGroup {
  id: string;
  name: string;
  rooms: RoomOverviewCard[];
  summary: ReturnType<typeof summarizeRoomOverview>;
}

export interface ReservationOperationalDay {
  isTodayCheckIn: boolean;
  isTodayCheckOut: boolean;
  isOccupied: boolean;
}

export interface RoomOperationalSchedule<T extends RoomOverviewReservation> {
  todayCheckIns: T[];
  todayCheckOuts: T[];
  nextCheckIns: T[];
  nextCheckOuts: T[];
}

export interface RoomOperationalScheduleReservation extends RoomOverviewReservation {
  roomId: string;
  roomName: string;
  hasConflict: boolean;
}

export function isValidReservation(reservation: RoomOverviewReservation) {
  return isValidReservationDateRange(reservation);
}

function isOperationalReservation(reservation: RoomOverviewReservation) {
  return isValidReservation(reservation)
    && ACTIVE_OTA_RESERVATION_STATUSES.includes(
      reservation.status as (typeof ACTIVE_OTA_RESERVATION_STATUSES)[number],
    );
}

export function getReservationOperationalDay(reservation: RoomOverviewReservation, todayStart: Date, todayEnd: Date): ReservationOperationalDay {
  void todayEnd;
  if (!isOperationalReservation(reservation)) {
    return { isTodayCheckIn: false, isTodayCheckOut: false, isOccupied: false };
  }
  return {
    isTodayCheckIn: isReservationCheckInOnDate(reservation, todayStart),
    isTodayCheckOut: isReservationCheckOutOnDate(reservation, todayStart),
    isOccupied: isReservationOccupiedOnDate(reservation, todayStart),
  };
}

export function calculateRoomOverviewStatus(input: { reservations: RoomOverviewReservation[]; activeConflictCount: number; todayStart: Date; todayEnd: Date }): RoomOverviewStatus {
  if (input.activeConflictCount > 0) return "CONFLICT";
  const operationalDays = input.reservations.map((reservation) => getReservationOperationalDay(reservation, input.todayStart, input.todayEnd));
  if (operationalDays.some((day) => day.isTodayCheckOut)) return "CHECK_OUT_TODAY";
  if (operationalDays.some((day) => day.isTodayCheckIn)) return "CHECK_IN_TODAY";
  if (operationalDays.some((day) => day.isOccupied)) return "OCCUPIED";
  return "VACANT";
}

export function selectCurrentReservation(reservations: RoomOverviewReservation[], todayStart: Date, todayEnd: Date) {
  return reservations.filter((reservation) => {
    const day = getReservationOperationalDay(reservation, todayStart, todayEnd);
    return day.isTodayCheckIn || day.isTodayCheckOut || day.isOccupied;
  }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ?? null;
}

export function selectNextReservation(reservations: RoomOverviewReservation[], todayEnd: Date) {
  const nextDay = getReservationDateOrdinal(todayEnd);
  return reservations.filter(isOperationalReservation).filter((item) => {
    const start = getReservationDateOrdinal(item.startDate);
    return nextDay !== null && start !== null && start >= nextDay;
  }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ?? null;
}

export function getRoomOverviewGuestName(reservation: RoomOverviewReservation | null) {
  return reservation ? getReservationDisplayName(reservation) : "예약자 정보 없음";
}

export function buildRoomOperationalSchedule<T extends RoomOverviewReservation>(reservations: T[], todayStart: Date, todayEnd: Date, rangeEnd: Date): RoomOperationalSchedule<T> {
  const entries = reservations
    .filter(isOperationalReservation)
    .map((reservation) => ({ reservation, day: getReservationOperationalDay(reservation, todayStart, todayEnd) }));
  const today = getReservationDateOrdinal(todayStart);
  const nextDay = getReservationDateOrdinal(todayEnd);
  const rangeEndDay = getReservationDateOrdinal(rangeEnd);
  const isNextDateInRange = (value: Date) => {
    const ordinal = getReservationDateOrdinal(value);
    return ordinal !== null && nextDay !== null && rangeEndDay !== null && ordinal >= nextDay && ordinal < rangeEndDay;
  };
  const isNextCheckoutInRange = (value: Date) => {
    const ordinal = getReservationDateOrdinal(value);
    return ordinal !== null && today !== null && rangeEndDay !== null && ordinal > today && ordinal <= rangeEndDay;
  };
  return {
    todayCheckIns: entries.filter((entry) => entry.day.isTodayCheckIn).map((entry) => entry.reservation),
    todayCheckOuts: entries.filter((entry) => entry.day.isTodayCheckOut).map((entry) => entry.reservation),
    nextCheckIns: entries.filter((entry) => isNextDateInRange(entry.reservation.startDate)).map((entry) => entry.reservation),
    nextCheckOuts: entries.filter((entry) => isNextCheckoutInRange(entry.reservation.endDate)).map((entry) => entry.reservation),
  };
}

export function summarizeRoomOverview(cards: RoomOverviewCard[]) {
  const statuses = Object.fromEntries(Object.keys(ROOM_OVERVIEW_STATUS_META).map((status) => [status, 0])) as Record<RoomOverviewStatus, number>;
  for (const card of cards) statuses[card.status] += 1;
  const cleaningStatuses = { INCOMPLETE: 0, COMPLETED: 0 } satisfies Record<RoomOverviewCleaningFilter, number>;
  for (const card of cards) {
    if (card.cleaningStatus !== "NONE") cleaningStatuses[card.cleaningStatus] += 1;
  }
  const operationalStatuses = { NONE: 0, CLEANING_REQUIRED: 0, INSPECTION_REQUIRED: 0 } satisfies Record<RoomOperationalStatus, number>;
  for (const card of cards) {
    if (card.operationalStatus !== "INSPECTION_REQUIRED") operationalStatuses[card.operationalStatus] += 1;
    if (requiresRoomInspection(card)) operationalStatuses.INSPECTION_REQUIRED += 1;
  }
  return { total: cards.length, statuses, cleaningStatuses, operationalStatuses };
}

export function getRoomOverviewCleaningStatus(
  tasks: readonly { status: CleaningTaskStatus }[],
): RoomOverviewCleaningStatus {
  if (tasks.some((task) => task.status === "PENDING" || task.status === "IN_PROGRESS")) {
    return "INCOMPLETE";
  }
  if (tasks.some((task) => task.status === "COMPLETED")) return "COMPLETED";
  return "NONE";
}

export function getRoomInspectionStatus(
  openNotes: readonly { acknowledgedAt: unknown | null; processedAt: unknown | null }[],
  hasCompletedNote = false,
): RoomInspectionStatus {
  if (openNotes.some((note) => note.acknowledgedAt === null)) return "INCOMPLETE";
  if (openNotes.some((note) => note.processedAt !== null)) return "IN_PROGRESS";
  if (openNotes.length > 0) return "READ";
  return hasCompletedNote ? "COMPLETED" : "NONE";
}

export function requiresRoomInspection(room: Pick<RoomOverviewCard, "pendingMemoCount">) {
  return room.pendingMemoCount > 0;
}

export function matchesRoomOperationalStatus(
  room: Pick<RoomOverviewCard, "operationalStatus" | "pendingMemoCount">,
  status: RoomOperationalStatus,
) {
  if (status === "INSPECTION_REQUIRED") return requiresRoomInspection(room);
  return room.operationalStatus === status;
}

export function sortRoomOverviewCards(cards: RoomOverviewCard[]) {
  return [...cards].sort((a, b) => a.propertyName.localeCompare(b.propertyName, "ko") || a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, "ko", { numeric: true }) || a.name.localeCompare(b.name, "ko", { numeric: true }));
}

export function groupRoomOverviewByProperty(
  cards: RoomOverviewCard[],
  options: { preserveRoomOrder?: boolean } = {},
): RoomOverviewPropertyGroup[] {
  const groups = new Map<string, { id: string; name: string; rooms: RoomOverviewCard[] }>();

  const orderedCards = options.preserveRoomOrder ? cards : sortRoomOverviewCards(cards);
  for (const room of orderedCards) {
    const group = groups.get(room.propertyId);
    if (group) {
      group.rooms.push(room);
      continue;
    }
    groups.set(room.propertyId, {
      id: room.propertyId,
      name: room.propertyName,
      rooms: [room],
    });
  }

  return [...groups.values()]
    .sort((left, right) => left.name.localeCompare(right.name, "ko"))
    .map((group) => ({
      ...group,
      summary: summarizeRoomOverview(group.rooms),
    }));
}
