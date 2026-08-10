import { calendarProviderRegistry } from "../src/providers/calendar";
import { parseIcsCalendar } from "../src/features/calendar-sync/infrastructure/ics-parser";
import { BookingReservationNormalizer } from "../src/features/calendar-sync/providers/booking-normalizer";
import { prisma } from "../src/lib/prisma";

function maskUid(uid: string) {
  const at = uid.lastIndexOf("@");
  return at >= 0 ? `***@${uid.slice(at + 1).toLowerCase()}` : `<masked:${uid.length}>`;
}

function safeText(value: string | null) {
  if (!value) return null;
  if (/\d|@|https?:\/\//i.test(value)) return `<masked:${value.length}>`;
  return value.length <= 80 ? value : `<masked:${value.length}>`;
}

function maskAddress(value: string | null) {
  if (!value) return null;
  const at = value.lastIndexOf("@");
  return at >= 0 ? `***@${value.slice(at + 1).toLowerCase()}` : `<present:${value.length}>`;
}

async function main() {
  const failedSource = await prisma.calendarSource.findFirst({
    where: {
      provider: "BOOKING",
      isActive: true,
      syncLogs: { some: { errorCode: "PROVIDER_CLASSIFICATION_FAILED" } },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, calendarUrl: true, syncLogs: { orderBy: { startedAt: "desc" }, take: 1, select: { errorCode: true, fetchedCount: true, parsedEventCount: true, reservationEventCount: true } } },
  });
  const source = failedSource ?? await prisma.calendarSource.findFirst({
    where: { provider: "BOOKING", isActive: true, syncLogs: { some: { fetchedCount: { gt: 0 } } } },
    orderBy: { lastSyncedAt: "desc" },
    select: { id: true, calendarUrl: true, syncLogs: { orderBy: { startedAt: "desc" }, take: 1, select: { errorCode: true, fetchedCount: true, parsedEventCount: true, reservationEventCount: true } } },
  });
  if (!source) throw new Error("No active Booking CalendarSource exists.");
  const url = new URL(source.calendarUrl);
  const document = await calendarProviderRegistry.get("BOOKING").fetchCalendar({ calendarUrl: source.calendarUrl });
  const parsed = parseIcsCalendar(document.content);
  const normalizer = new BookingReservationNormalizer();
  console.log(JSON.stringify({ sourceId: source.id, selection: failedSource ? "latest-classification-failure" : "latest-source-with-events", url: { protocol: url.protocol, hostname: url.hostname.toLowerCase(), pathname: url.pathname, queryNames: [...url.searchParams.keys()].sort() }, latestLog: source.syncLogs[0] ?? null, downloaded: { totalEventCount: parsed.totalEventCount, parsedEventCount: parsed.events.length, issues: parsed.issues } }));
  for (const event of parsed.events.slice(0, 3)) {
    console.log(JSON.stringify({
      uid: maskUid(event.uid),
      dtstart: event.startDate.toISOString(),
      dtend: event.endDate.toISOString(),
      summary: safeText(event.summary),
      description: event.description ? `<masked:${event.description.length}>` : null,
      status: safeText(event.status),
      transp: safeText(event.rawProperties.transp ?? null),
      organizer: maskAddress(event.rawProperties.organizer ?? null),
      customProperties: Object.keys(event.rawProperties).filter((name) => name.startsWith("x-")).sort(),
      classification: normalizer.classifyEvent(event),
    }));
  }
}

main().finally(() => prisma.$disconnect());
