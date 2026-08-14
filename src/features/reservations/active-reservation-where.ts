import "server-only";

import { roomScopeWhere } from "@/features/access-control";
import { getDashboardTodayRange } from "@/features/dashboard/dashboard-time";
import type { Prisma } from "@/lib/generated/prisma/client";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "./reservation.constants";
import { isActiveReservationDisplayStatus, type ActiveReservationDisplayStatus } from "./reservation-display-status";
import type { ReservationFilters } from "./reservation.types";

function buildActiveReservationStateWhere(): Prisma.ReservationWhereInput {
  return {
    status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] },
    calendarSource: { is: { isActive: true } },
  };
}

export function buildActiveReservationBaseWhere(businessDate: Date): Prisma.ReservationWhereInput {
  const { start } = getDashboardTodayRange(businessDate);
  return { ...buildActiveReservationStateWhere(), endDate: { gte: start } };
}

function displayStatusWhere(status: ActiveReservationDisplayStatus, businessDate: Date): Prisma.ReservationWhereInput {
  const { start, end } = getDashboardTodayRange(businessDate);
  if (status === "CHECK_IN_TODAY") return { startDate: { gte: start, lt: end } };
  if (status === "CHECK_OUT_TODAY") return { startDate: { lt: start }, endDate: { gte: start, lt: end } };
  if (status === "STAYING") return { startDate: { lt: start }, endDate: { gte: end } };
  return { startDate: { gte: end } };
}

function laterDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

function scopedRoomWhere(
  companyIds: readonly string[] | undefined,
  accessScope: ReservationFilters["accessScope"],
): Prisma.RoomWhereInput | undefined {
  const accessWhere = roomScopeWhere(accessScope);
  if (accessWhere) return accessWhere;
  return companyIds?.length ? { property: { companyId: { in: [...companyIds] } } } : undefined;
}

export function buildActiveReservationWhere(filters: ReservationFilters): Prisma.ReservationWhereInput {
  const { start: businessDateStart } = getDashboardTodayRange(filters.businessDate);
  const requestedEndDateStart = filters.dateField === "checkOut" || filters.dateField === "stay"
    ? filters.from
    : businessDateStart;
  const endDateStart = laterDate(businessDateStart, requestedEndDateStart);
  const endDate: Prisma.DateTimeFilter | undefined = filters.dateMode === "checkout"
    ? { gte: filters.from, lt: filters.toExclusive }
    : filters.dateMode === "checkin"
      ? undefined
      : filters.dateField === "checkOut"
        ? { gte: endDateStart, lt: filters.toExclusive }
        : { gte: endDateStart };
  const dateWhere: Prisma.ReservationWhereInput = filters.dateMode === "checkin"
    ? { startDate: { gte: filters.from, lt: filters.toExclusive } }
    : filters.dateMode === "checkout"
      ? {}
      : filters.dateField === "checkIn"
    ? { startDate: { gte: filters.from, lt: filters.toExclusive } }
    : filters.dateField === "checkOut"
      ? {}
      : { startDate: { lt: filters.toExclusive } };
  const search = filters.search?.trim();
  const activeConflictWhere: Prisma.ReservationWhereInput = {
    OR: [
      { conflictsAsA: { some: { status: "ACTIVE" } } },
      { conflictsAsB: { some: { status: "ACTIVE" } } },
    ],
  };
  const conditions: Prisma.ReservationWhereInput[] = [];
  if (search) {
    conditions.push({
      OR: [
        { id: { contains: search, mode: "insensitive" } },
        { guestName: { contains: search, mode: "insensitive" } },
        { providerReservationId: { contains: search, mode: "insensitive" } },
        { room: { name: { contains: search, mode: "insensitive" } } },
        { property: { name: { contains: search, mode: "insensitive" } } },
        { calendarSource: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.hasConflict !== undefined) conditions.push(filters.hasConflict ? activeConflictWhere : { NOT: activeConflictWhere });
  const displayStatuses = filters.displayStatuses?.filter(isActiveReservationDisplayStatus) ?? [];
  if (displayStatuses.length) conditions.push({ OR: displayStatuses.map((status) => displayStatusWhere(status, filters.businessDate)) });

  const room = scopedRoomWhere(filters.companyIds, filters.accessScope);
  return {
    ...buildActiveReservationStateWhere(),
    ...(endDate ? { endDate } : {}),
    ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    ...(filters.roomId ? { roomId: filters.roomId } : {}),
    provider: { in: [...(filters.providers?.length ? filters.providers : CALENDAR_PROVIDER_TYPES)] },
    ...(room ? { room } : {}),
    ...(conditions.length ? { AND: conditions } : {}),
    ...dateWhere,
  };
}

export function buildScopedActiveReservationWhere(input: {
  businessDate: Date;
  companyIds?: readonly string[];
  accessScope?: ReservationFilters["accessScope"];
}): Prisma.ReservationWhereInput {
  const room = scopedRoomWhere(input.companyIds, input.accessScope);
  return {
    ...buildActiveReservationBaseWhere(input.businessDate),
    provider: { in: [...CALENDAR_PROVIDER_TYPES] },
    ...(room ? { room } : {}),
  };
}
