import type { CalendarProviderType, ReservationStatus, RoomOperationalStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import { getReservationDisplayName } from "../../reservations/reservation-display";

export type RoomReservationState = "VACANT" | "CHECK_IN_TODAY" | "OCCUPIED" | "CHECK_OUT_TODAY" | "CONFLICT";
export type RoomOverviewStatus = RoomReservationState;

export const ROOM_OVERVIEW_STATUS_PRIORITY = ["CONFLICT", "CHECK_OUT_TODAY", "CHECK_IN_TODAY", "OCCUPIED", "VACANT"] as const satisfies readonly RoomReservationState[];

export const ROOM_OVERVIEW_STATUS_META = {
  VACANT: { label: "공실" },
  CHECK_IN_TODAY: { label: "오늘 체크인" },
  OCCUPIED: { label: "투숙 중" },
  CHECK_OUT_TODAY: { label: "오늘 체크아웃" },
  CONFLICT: { label: "오버부킹" },
} satisfies Record<RoomReservationState, { label: string }>;

export interface RoomOverviewReservation {
  id: string;
  guestName: string | null;
  provider: CalendarProviderType;
  status: ReservationStatus;
  startDate: Date;
  endDate: Date;
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
  providers: CalendarProviderType[];
  latestSync: { status: SyncStatus; startedAt: Date; completedAt: Date | null } | null;
  syncStates: Array<{ provider: CalendarProviderType; status: SyncStatus; startedAt: Date; completedAt: Date | null }>;
  reservations: RoomOverviewReservation[];
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
  return Number.isFinite(reservation.startDate.getTime()) && Number.isFinite(reservation.endDate.getTime()) && reservation.startDate < reservation.endDate;
}

export function getReservationOperationalDay(reservation: RoomOverviewReservation, todayStart: Date, todayEnd: Date): ReservationOperationalDay {
  if (!isValidReservation(reservation) || reservation.status === "CANCELLED" || reservation.status === "BLOCKED") {
    return { isTodayCheckIn: false, isTodayCheckOut: false, isOccupied: false };
  }
  return {
    isTodayCheckIn: reservation.startDate >= todayStart && reservation.startDate < todayEnd,
    isTodayCheckOut: reservation.endDate > todayStart && reservation.endDate <= todayEnd,
    isOccupied: reservation.startDate < todayStart && reservation.endDate > todayStart,
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
  return reservations.filter(isValidReservation).filter((item) => item.status !== "CANCELLED" && item.status !== "BLOCKED" && item.startDate >= todayEnd).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ?? null;
}

export function getRoomOverviewGuestName(reservation: RoomOverviewReservation | null) {
  return reservation ? getReservationDisplayName(reservation) : "예약자 정보 없음";
}

export function buildRoomOperationalSchedule<T extends RoomOverviewReservation>(reservations: T[], todayStart: Date, todayEnd: Date, rangeEnd: Date): RoomOperationalSchedule<T> {
  const entries = reservations
    .filter((reservation) => isValidReservation(reservation) && reservation.status !== "CANCELLED" && reservation.status !== "BLOCKED")
    .map((reservation) => ({ reservation, day: getReservationOperationalDay(reservation, todayStart, todayEnd) }));
  return {
    todayCheckIns: entries.filter((entry) => entry.day.isTodayCheckIn).map((entry) => entry.reservation),
    todayCheckOuts: entries.filter((entry) => entry.day.isTodayCheckOut).map((entry) => entry.reservation),
    nextCheckIns: entries.filter((entry) => entry.reservation.startDate >= todayEnd && entry.reservation.startDate < rangeEnd).map((entry) => entry.reservation),
    nextCheckOuts: entries.filter((entry) => entry.reservation.endDate > todayEnd && entry.reservation.endDate <= rangeEnd).map((entry) => entry.reservation),
  };
}

export function summarizeRoomOverview(cards: RoomOverviewCard[]) {
  const statuses = Object.fromEntries(Object.keys(ROOM_OVERVIEW_STATUS_META).map((status) => [status, 0])) as Record<RoomOverviewStatus, number>;
  for (const card of cards) statuses[card.status] += 1;
  const operationalStatuses = { NONE: 0, CLEANING_REQUIRED: 0, INSPECTION_REQUIRED: 0 } satisfies Record<RoomOperationalStatus, number>;
  for (const card of cards) operationalStatuses[card.operationalStatus] += 1;
  return { total: cards.length, statuses, operationalStatuses };
}

export function sortRoomOverviewCards(cards: RoomOverviewCard[]) {
  return [...cards].sort((a, b) => a.propertyName.localeCompare(b.propertyName, "ko") || a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, "ko", { numeric: true }) || a.name.localeCompare(b.name, "ko", { numeric: true }));
}
