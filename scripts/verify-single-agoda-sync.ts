import { syncCalendarSource } from "../src/features/calendar-sync/application/sync-calendar-source";
import { prisma } from "../src/lib/prisma";

async function main() {
  const source = await prisma.calendarSource.findFirst({
    where: { provider: "AGODA", isActive: true },
    orderBy: process.argv.includes("--with-reservations") ? { reservations: { _count: "desc" } } : { createdAt: "asc" },
    select: { id: true, _count: { select: { reservations: true } } },
  });
  if (!source) throw new Error("No active Agoda CalendarSource exists.");
  const result = await syncCalendarSource(source.id);
  const after = await prisma.calendarSource.findUniqueOrThrow({
    where: { id: source.id },
    select: {
      _count: { select: { reservations: true } },
      syncLogs: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true, errorCode: true, fetchedCount: true, parsedEventCount: true, reservationEventCount: true, createdCount: true, updatedCount: true } },
    },
  });
  console.log(JSON.stringify({
    provider: "AGODA",
    sourceId: source.id,
    reservationsBefore: source._count.reservations,
    reservationsAfter: after._count.reservations,
    result,
    latestSyncLog: after.syncLogs[0] ?? null,
  }));
}

main().finally(() => prisma.$disconnect());
