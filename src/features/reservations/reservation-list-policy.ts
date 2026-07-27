import type { ReservationStatus } from "@/lib/generated/prisma/enums";
import { getDashboardDateInput } from "../dashboard/dashboard-time";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "./reservation.constants";

export function isActiveReservationListItem(input: {
  reservationStatus: ReservationStatus;
  endDate: Date;
  businessDate: Date;
}): boolean {
  return ACTIVE_OTA_RESERVATION_STATUSES.includes(input.reservationStatus as (typeof ACTIVE_OTA_RESERVATION_STATUSES)[number])
    && getDashboardDateInput(input.endDate) >= getDashboardDateInput(input.businessDate);
}
