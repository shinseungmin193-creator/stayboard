import "server-only";
import { prisma } from "@/lib/prisma";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";

const safetyReservationSelect = {
  id: true,
  rawUid: true,
  calendarSourceId: true,
  roomId: true,
  startDate: true,
  endDate: true,
  status: true,
} as const;

export function findCalendarFeedSafetyContext(calendarSourceId: string) {
  return prisma.calendarSource.findUnique({
    where: { id: calendarSourceId },
    select: {
      id: true,
      roomId: true,
      feedFingerprint: true,
      reservations: { select: safetyReservationSelect },
      syncLogs: {
        where: { status: "SUCCESS", quarantined: false },
        orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { fetchedCount: true, reservationEventCount: true, unknownEventCount: true },
      },
      room: {
        select: {
          reservations: {
            where: {
              status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] },
              provider: { in: [...CALENDAR_PROVIDER_TYPES] },
              calendarSource: { is: { isActive: true } },
            },
            select: safetyReservationSelect,
          },
        },
      },
    },
  });
}
