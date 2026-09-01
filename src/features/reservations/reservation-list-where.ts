import "server-only";

import { roomScopeWhere } from "@/features/access-control";
import { getDashboardTodayRange } from "@/features/dashboard/dashboard-time";
import type { Prisma } from "@/lib/generated/prisma/client";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";
import { buildOperationalReservationWhere } from "./operational-reservation-where";
import { isActiveReservationDisplayStatus, type ActiveReservationDisplayStatus } from "./reservation-display-status";
import { buildReservationListDateWhere } from "./reservation-list-date-where";
import type { ReservationFilters } from "./reservation.types";

function displayStatusWhere(
  status: ActiveReservationDisplayStatus,
  businessDate: Date,
): Prisma.ReservationWhereInput {
  const { start, end } = getDashboardTodayRange(businessDate);
  if (status === "CHECK_IN_TODAY") return { startDate: { gte: start, lt: end } };
  if (status === "CHECK_OUT_TODAY") return { startDate: { lt: start }, endDate: { gt: start, lte: end } };
  if (status === "STAYING") return { startDate: { lt: start }, endDate: { gt: end } };
  return { startDate: { gte: end } };
}

function scopedRoomWhere(
  companyIds: readonly string[] | undefined,
  accessScope: ReservationFilters["accessScope"],
): Prisma.RoomWhereInput | undefined {
  const accessWhere = roomScopeWhere(accessScope);
  if (accessWhere) return accessWhere;
  return companyIds?.length ? { property: { companyId: { in: [...companyIds] } } } : undefined;
}

export function buildReservationListWhere(filters: ReservationFilters): Prisma.ReservationWhereInput {
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
  if (filters.hasConflict !== undefined) {
    conditions.push(filters.hasConflict ? activeConflictWhere : { NOT: activeConflictWhere });
  }
  const displayStatuses = filters.displayStatuses?.filter(isActiveReservationDisplayStatus) ?? [];
  if (displayStatuses.length) {
    conditions.push({
      OR: displayStatuses.map((status) => displayStatusWhere(status, filters.businessDate)),
    });
  }

  const room = scopedRoomWhere(filters.companyIds, filters.accessScope);
  return {
    ...buildReservationListDateWhere(filters),
    ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    ...(filters.roomId ? { roomId: filters.roomId } : {}),
    provider: { in: [...(filters.providers?.length ? filters.providers : CALENDAR_PROVIDER_TYPES)] },
    AND: [
      buildOperationalReservationWhere(),
      ...(room ? [{ room: { is: room } }] : []),
      ...conditions,
    ],
  };
}

export function buildScopedReservationHistoryWhere(input: {
  companyIds?: readonly string[];
  accessScope?: ReservationFilters["accessScope"];
}): Prisma.ReservationWhereInput {
  const room = scopedRoomWhere(input.companyIds, input.accessScope);
  return {
    AND: [
      buildOperationalReservationWhere(),
      ...(room ? [{ room: { is: room } }] : []),
    ],
  };
}
