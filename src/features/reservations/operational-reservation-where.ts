import type { Prisma } from "../../lib/generated/prisma/client";
import { CALENDAR_PROVIDER_TYPES } from "../../providers/calendar/types";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "./reservation.constants";

export function buildOperationalReservationWhere(): Prisma.ReservationWhereInput {
  return {
    status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] },
    provider: { in: [...CALENDAR_PROVIDER_TYPES] },
    calendarSource: { is: { isActive: true } },
    room: {
      is: {
        isActive: true,
        property: { isActive: true, company: { isActive: true } },
      },
    },
  };
}
