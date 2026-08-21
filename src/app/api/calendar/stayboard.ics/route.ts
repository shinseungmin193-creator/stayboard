const EMPTY_STAYBOARD_CALENDAR = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//StayBoard//Calendar//EN",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "END:VCALENDAR",
  "",
].join("\r\n");

export const dynamic = "force-static";

export function GET() {
  return new Response(EMPTY_STAYBOARD_CALENDAR, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="stayboard.ics"',
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
