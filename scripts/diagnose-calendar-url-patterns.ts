import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function pattern(calendarUrl: string) {
  try {
    const url = new URL(calendarUrl);
    return {
      protocol: url.protocol,
      hostname: url.hostname.toLowerCase(),
      pathnamePattern: url.pathname.replace(/[A-Za-z0-9_-]{8,}/g, "***"),
      queryNames: [...new Set(url.searchParams.keys())].sort(),
      length: calendarUrl.length,
    };
  } catch {
    return { malformed: true, length: calendarUrl.length };
  }
}

async function main() {
  const result = await pool.query<{ provider: string; calendarUrl: string }>(
    `SELECT "provider", "calendarUrl"
       FROM "CalendarSource"
      WHERE "provider" IN ('AGODA', 'AIRBNB', 'BOOKING')
      ORDER BY "createdAt" ASC`,
  );
  for (const provider of ["AGODA", "AIRBNB", "BOOKING"]) {
    const rows = result.rows.filter((row) => row.provider === provider);
    console.log(provider, "count", rows.length);
    for (const row of rows.slice(0, provider === "AGODA" ? 10 : 2)) console.log(JSON.stringify(pattern(row.calendarUrl)));
  }
  if (process.argv.includes("--probe-agoda")) {
    const source = result.rows.find((row) => row.provider === "AGODA");
    if (!source) return;
    const response = await fetch(source.calendarUrl, { redirect: "manual", headers: { Accept: "text/calendar,text/plain", "User-Agent": "StayBoard-Calendar/1.0" } });
    const location = response.headers.get("location");
    const redirect = location ? new URL(location, source.calendarUrl) : null;
    console.log(JSON.stringify({ probe: "AGODA", status: response.status, initialHost: new URL(source.calendarUrl).hostname.toLowerCase(), redirectHost: redirect?.hostname.toLowerCase() ?? null, redirectPathPattern: redirect?.pathname.replace(/[A-Za-z0-9_-]{8,}/g, "***") ?? null }));
    await response.body?.cancel();
  }
}

main().finally(() => pool.end());
