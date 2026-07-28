import type { RoomOverviewCard, RoomOverviewReservation, RoomOverviewStatus } from "./room-overview";

export const ROOM_STATUS_VIEW_MODES = ["card", "list", "calendar"] as const;
export type RoomStatusViewMode = (typeof ROOM_STATUS_VIEW_MODES)[number];

export const CALENDAR_RANGE_OPTIONS = [3, 7, 14, 30] as const;
export type CalendarRangeDays = (typeof CALENDAR_RANGE_OPTIONS)[number];
export const DEFAULT_CALENDAR_RANGE: CalendarRangeDays = 7;
export const TIMELINE_ROOM_COLUMN_WIDTH = 132;
export const TIMELINE_ROW_MIN_HEIGHT = 44;
export const TIMELINE_RESERVATION_HEIGHT = 20;
export const TIMELINE_DATE_COLUMN_WIDTHS: Record<CalendarRangeDays, number> = {
  3: 88,
  7: 72,
  14: 58,
  30: 48,
};

export const MOBILE_ROOM_STATUS_FILTERS = [
  "ALL",
  "RESERVED",
  "VACANT",
  "CHECK_IN_TODAY",
  "CHECK_OUT_TODAY",
  "CLEANING",
  "CONFLICT",
] as const;
export type MobileRoomStatusFilter = (typeof MOBILE_ROOM_STATUS_FILTERS)[number];

export const MOBILE_ROOM_OTA_FILTERS = ["ALL", "CONNECTED", "DISCONNECTED"] as const;
export type MobileRoomOtaFilter = (typeof MOBILE_ROOM_OTA_FILTERS)[number];

export const MOBILE_ROOM_SYNC_FILTERS = ["ALL", "ERROR", "NORMAL"] as const;
export type MobileRoomSyncFilter = (typeof MOBILE_ROOM_SYNC_FILTERS)[number];

export const MOBILE_ROOM_SORT_FIELDS = ["room", "property", "status", "checkIn", "checkOut"] as const;
export type MobileRoomSortField = (typeof MOBILE_ROOM_SORT_FIELDS)[number];
export type MobileRoomSortDirection = "asc" | "desc";

export interface MobileRoomFilters {
  query: string;
  status: MobileRoomStatusFilter;
  ota: MobileRoomOtaFilter;
  sync: MobileRoomSyncFilter;
}

export interface MobileRoomSummary {
  total: number;
  reserved: number;
  vacant: number;
  checkIn: number;
  checkOut: number;
  cleaning: number;
  conflict: number;
}

export interface MobileRoomCalendarSegment {
  id: string;
  provider: string;
  leftDays: number;
  durationDays: number;
  hasConflict: boolean;
  lane: number;
  laneCount: number;
  startsInRange: boolean;
  endsInRange: boolean;
  reservation: RoomOverviewReservation;
}

export interface MobileRoomCalendarGroup {
  id: string;
  label: string;
  roomCount: number;
  reservationCount: number;
  conflictCount: number;
  rooms: RoomOverviewCard[];
}

const TIME_ZONE = "Asia/Tokyo";
const ERROR_SYNC_STATUSES = new Set(["FAILED", "TIMEOUT"]);

function dateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { year: Number(part("year")), month: Number(part("month")), day: Number(part("day")) };
}

function dateKeyOrdinal(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function roomOverviewDateKey(value = new Date()) {
  const { year, month, day } = dateParts(value);
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function parseRoomOverviewDateKey(value: string | undefined, fallback = roomOverviewDateKey()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return fallback;
  return value;
}

export function roomOverviewDateInstant(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+09:00`);
}

export function moveRoomOverviewDate(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + amount));
  return `${target.getUTCFullYear().toString().padStart(4, "0")}-${(target.getUTCMonth() + 1).toString().padStart(2, "0")}-${target.getUTCDate().toString().padStart(2, "0")}`;
}

export function isCalendarRangeDays(value: unknown): value is CalendarRangeDays {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && CALENDAR_RANGE_OPTIONS.includes(numeric as CalendarRangeDays);
}

export function parseCalendarRangeDays(value: string | undefined): CalendarRangeDays {
  return isCalendarRangeDays(value) ? Number(value) as CalendarRangeDays : DEFAULT_CALENDAR_RANGE;
}

export function getCalendarRangeStart(anchorDateKey: string, dayCount: CalendarRangeDays) {
  return moveRoomOverviewDate(anchorDateKey, -Math.floor(dayCount / 2));
}

export function buildCalendarDateRange(anchorDateKey: string, dayCount: CalendarRangeDays) {
  const startDateKey = getCalendarRangeStart(anchorDateKey, dayCount);
  return Array.from({ length: dayCount }, (_, index) => moveRoomOverviewDate(startDateKey, index));
}

export function hasRoomSyncError(room: RoomOverviewCard) {
  return room.syncStates.some((sync) => ERROR_SYNC_STATUSES.has(sync.status));
}

export function summarizeMobileRooms(rooms: readonly RoomOverviewCard[]): MobileRoomSummary {
  const summary: MobileRoomSummary = { total: rooms.length, reserved: 0, vacant: 0, checkIn: 0, checkOut: 0, cleaning: 0, conflict: 0 };
  for (const room of rooms) {
    if (room.status === "VACANT") summary.vacant += 1;
    if (room.status === "OCCUPIED" || room.status === "CONFLICT") summary.reserved += 1;
    if (room.status === "CHECK_IN_TODAY") summary.checkIn += 1;
    if (room.status === "CHECK_OUT_TODAY") summary.checkOut += 1;
    if (room.operationalStatus === "CLEANING_REQUIRED") summary.cleaning += 1;
    if (room.status === "CONFLICT") summary.conflict += 1;
  }
  return summary;
}

function matchesStatus(room: RoomOverviewCard, status: MobileRoomStatusFilter) {
  if (status === "ALL") return true;
  if (status === "RESERVED") return room.status === "OCCUPIED" || room.status === "CONFLICT";
  if (status === "CLEANING") return room.operationalStatus === "CLEANING_REQUIRED";
  return room.status === status;
}

export function filterMobileRooms(rooms: readonly RoomOverviewCard[], filters: MobileRoomFilters) {
  const query = filters.query.trim().toLocaleLowerCase("ko");
  return rooms.filter((room) => {
    if (query && !`${room.code} ${room.name} ${room.propertyName}`.toLocaleLowerCase("ko").includes(query)) return false;
    if (!matchesStatus(room, filters.status)) return false;
    if (filters.ota === "CONNECTED" && room.providers.length === 0) return false;
    if (filters.ota === "DISCONNECTED" && room.providers.length > 0) return false;
    const syncError = hasRoomSyncError(room);
    if (filters.sync === "ERROR" && !syncError) return false;
    if (filters.sync === "NORMAL" && syncError) return false;
    return true;
  });
}

function reservationDate(room: RoomOverviewCard, field: "startDate" | "endDate") {
  const reservation = room.currentReservation ?? room.nextReservation;
  return reservation?.[field].getTime() ?? Number.POSITIVE_INFINITY;
}

function compareStatus(left: RoomOverviewStatus, right: RoomOverviewStatus) {
  const order: RoomOverviewStatus[] = ["CHECK_IN_TODAY", "CHECK_OUT_TODAY", "OCCUPIED", "VACANT", "CONFLICT"];
  return order.indexOf(left) - order.indexOf(right);
}

export function sortMobileRooms(
  rooms: readonly RoomOverviewCard[],
  field: MobileRoomSortField,
  direction: MobileRoomSortDirection,
) {
  const sign = direction === "asc" ? 1 : -1;
  return [...rooms].sort((left, right) => {
    let compared = 0;
    if (field === "room") compared = left.name.localeCompare(right.name, "ko", { numeric: true });
    if (field === "property") compared = left.propertyName.localeCompare(right.propertyName, "ko", { numeric: true });
    if (field === "status") compared = compareStatus(left.status, right.status);
    if (field === "checkIn") compared = reservationDate(left, "startDate") - reservationDate(right, "startDate");
    if (field === "checkOut") compared = reservationDate(left, "endDate") - reservationDate(right, "endDate");
    if (!Number.isFinite(compared)) compared = 0;
    return compared * sign || left.propertyName.localeCompare(right.propertyName, "ko") || left.name.localeCompare(right.name, "ko", { numeric: true });
  });
}

export function buildMobileRoomCalendarSegments(
  room: RoomOverviewCard,
  startDateKey: string,
  dayCount = 7,
): MobileRoomCalendarSegment[] {
  const rangeStart = dateKeyOrdinal(startDateKey);
  const rangeEnd = rangeStart + dayCount;
  const segments = room.reservations.flatMap((reservation) => {
    if (reservation.status === "CANCELLED" || reservation.status === "BLOCKED") return [];
    const start = dateKeyOrdinal(roomOverviewDateKey(reservation.startDate));
    const end = dateKeyOrdinal(roomOverviewDateKey(reservation.endDate));
    if (start >= end || end <= rangeStart || start >= rangeEnd) return [];
    const clippedStart = Math.max(start, rangeStart);
    const clippedEnd = Math.min(end, rangeEnd);
    return [{
      id: reservation.id,
      provider: reservation.provider,
      leftDays: clippedStart - rangeStart,
      durationDays: clippedEnd - clippedStart,
      hasConflict: room.activeConflictCount > 0,
      lane: 0,
      laneCount: 1,
      startsInRange: start >= rangeStart,
      endsInRange: end <= rangeEnd,
      reservation,
    }];
  }).sort((left, right) => left.leftDays - right.leftDays || right.durationDays - left.durationDays || left.id.localeCompare(right.id));

  const laneEnds: number[] = [];
  for (const segment of segments) {
    const lane = laneEnds.findIndex((end) => end <= segment.leftDays);
    segment.lane = lane === -1 ? laneEnds.length : lane;
    laneEnds[segment.lane] = segment.leftDays + segment.durationDays;
  }
  for (const segment of segments) segment.laneCount = Math.max(1, laneEnds.length);
  return segments;
}

export function groupRoomsForCalendar(
  rooms: readonly RoomOverviewCard[],
  startDateKey: string,
  dayCount: CalendarRangeDays,
): MobileRoomCalendarGroup[] {
  const grouped = new Map<string, RoomOverviewCard[]>();
  for (const room of rooms) {
    const existing = grouped.get(room.propertyId);
    if (existing) existing.push(room);
    else grouped.set(room.propertyId, [room]);
  }
  return [...grouped.entries()].map(([id, groupRooms]) => ({
    id,
    label: groupRooms[0]?.propertyName ?? "숙소",
    roomCount: groupRooms.length,
    reservationCount: groupRooms.reduce((count, room) => count + buildMobileRoomCalendarSegments(room, startDateKey, dayCount).length, 0),
    conflictCount: groupRooms.reduce((count, room) => count + (room.activeConflictCount > 0 ? 1 : 0), 0),
    rooms: [...groupRooms],
  }));
}
