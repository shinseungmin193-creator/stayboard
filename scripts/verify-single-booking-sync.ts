import { syncCalendarSource } from "../src/features/calendar-sync/application/sync-calendar-source";
import { prisma } from "../src/lib/prisma";

async function main() {
  const source = await prisma.calendarSource.findFirst({
    where: {
      provider: "BOOKING",
      isActive: true,
      syncLogs: { some: { fetchedCount: { gt: 0 } } },
    },
    orderBy: { lastSyncedAt: "desc" },
    select: {
      id: true,
      reservations: { select: { rawUid: true } },
    },
  });
  if (!source) throw new Error("No active Booking CalendarSource with events exists.");

  const result = await syncCalendarSource(source.id);
  const after = await prisma.calendarSource.findUniqueOrThrow({
    where: { id: source.id },
    select: {
      reservations: { select: { rawUid: true } },
      syncLogs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          status: true,
          errorCode: true,
          fetchedCount: true,
          parsedEventCount: true,
          reservationEventCount: true,
          blockedEventCount: true,
          cancelledEventCount: true,
          unknownEventCount: true,
          failedEventCount: true,
          createdCount: true,
          updatedCount: true,
          cancelledCount: true,
        },
      },
    },
  });
  const uniqueAfterUids = new Set(after.reservations.map((reservation) => reservation.rawUid));

  console.log(JSON.stringify({
    provider: "BOOKING",
    sourceId: source.id,
    reservationsBefore: source.reservations.length,
    reservationsAfter: after.reservations.length,
    duplicateUidCount: after.reservations.length - uniqueAfterUids.size,
    result,
    latestSyncLog: after.syncLogs[0] ?? null,
  }));
}

main().finally(() => prisma.$disconnect());
