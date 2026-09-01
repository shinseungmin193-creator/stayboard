import "server-only";

import { getDashboardTodayRange } from "@/features/dashboard/dashboard-time";
import type { Prisma } from "@/lib/generated/prisma/client";
import { buildOperationalReservationWhere } from "./operational-reservation-where";

function buildActiveReservationStateWhere(): Prisma.ReservationWhereInput {
  return buildOperationalReservationWhere();
}

export function buildActiveReservationBaseWhere(businessDate: Date): Prisma.ReservationWhereInput {
  const { start } = getDashboardTodayRange(businessDate);
  return { ...buildActiveReservationStateWhere(), endDate: { gt: start } };
}
