import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { classifyCalendarEvents } from "../src/features/calendar-sync/domain/classify-calendar-events";
import { parseIcsCalendar } from "../src/features/calendar-sync/infrastructure/ics-parser";
import { reservationNormalizerRegistry } from "../src/features/calendar-sync/providers/normalizer-registry";
import { ICS_DOWNLOAD_TIMEOUT_MS, ICS_MAX_RESPONSE_BYTES, PROVIDER_HOSTS } from "../src/providers/calendar/constants";
import type { CalendarProviderType } from "../src/providers/calendar/types";

interface CalendarSourceRow {
  sourceId: string;
  provider: string;
  calendarUrl: string;
  companyName: string;
  propertyName: string;
  roomName: string;
}

interface CleanupCandidate {
  id: string;
  provider: CalendarProviderType;
  companyName: string;
  propertyName: string;
  roomName: string;
}

interface BlockedEventCandidate extends Omit<CleanupCandidate, "id"> {
  sourceId: string;
  rawUid: string;
}

const SUPPORTED_PROVIDERS = new Set<CalendarProviderType>(["AIRBNB", "BOOKING", "AGODA"]);

function isSupportedProvider(value: string): value is CalendarProviderType {
  return SUPPORTED_PROVIDERS.has(value as CalendarProviderType);
}

function assertSafeCalendarUrl(provider: CalendarProviderType, calendarUrl: string): URL {
  const url = new URL(calendarUrl);
  const allowedHosts = PROVIDER_HOSTS[provider] as readonly string[];
  if (url.protocol !== "https:" || url.username || url.password || !allowedHosts.includes(url.hostname.toLocaleLowerCase("en-US"))) throw new Error("UnsafeCalendarUrl");
  return url;
}

async function readLimitedBody(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > ICS_MAX_RESPONSE_BYTES) throw new Error("CalendarResponseTooLarge");
  if (!response.body) throw new Error("EmptyCalendarResponse");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > ICS_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("CalendarResponseTooLarge");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function downloadCalendar(provider: CalendarProviderType, calendarUrl: string): Promise<string> {
  const url = assertSafeCalendarUrl(provider, calendarUrl);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(ICS_DOWNLOAD_TIMEOUT_MS), headers: { Accept: "text/calendar,text/plain;q=0.9,application/octet-stream;q=0.8", "User-Agent": "StayBoard-Calendar-Cleanup/1.0" } });
  if (!response.ok) throw new Error(`CalendarHttp${response.status}`);
  const content = (await readLimitedBody(response)).replace(/^\uFEFF/u, "").trim();
  if (!content.includes("BEGIN:VCALENDAR") || !content.includes("END:VCALENDAR")) throw new Error("InvalidCalendarDocument");
  return content;
}

function printSummary(candidates: readonly CleanupCandidate[], processedSourceCount: number, failedSourceCount: number, apply: boolean): void {
  const grouped = new Map<string, { companyName: string; propertyName: string; roomName: string; provider: CalendarProviderType; count: number }>();
  for (const candidate of candidates) {
    const key = [candidate.companyName, candidate.propertyName, candidate.roomName, candidate.provider].join("\u0000");
    const current = grouped.get(key);
    if (current) current.count += 1;
    else grouped.set(key, { companyName: candidate.companyName, propertyName: candidate.propertyName, roomName: candidate.roomName, provider: candidate.provider, count: 1 });
  }

  console.log(`모드: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`확인한 CalendarSource: ${processedSourceCount}개 · 실패: ${failedSourceCount}개`);
  for (const item of grouped.values()) console.log(`${item.companyName} / ${item.propertyName} / ${item.roomName} / ${item.provider}: ${item.count}건`);
  console.log(`정리 대상 합계: ${candidates.length}건`);
  if (failedSourceCount > 0) console.log("실패한 CalendarSource는 건드리지 않으며, 성공적으로 재분류된 Source의 정확한 UID만 정리합니다.");
  if (!apply) console.log("실제 데이터는 변경하지 않았습니다. 반영하려면 --apply를 사용하세요.");
}

async function main(): Promise<void> {
  const argumentsSet = new Set(process.argv.slice(2));
  const invalidArguments = [...argumentsSet].filter((argument) => argument !== "--apply");
  if (invalidArguments.length) throw new Error("지원하지 않는 인자가 있습니다. --apply만 사용할 수 있습니다.");
  const apply = argumentsSet.has("--apply");
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 환경 변수가 필요합니다.");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const sourceResult = await client.query<CalendarSourceRow>(`
      SELECT
        source."id" AS "sourceId",
        source."provider"::text AS "provider",
        source."calendarUrl" AS "calendarUrl",
        company."name" AS "companyName",
        property."name" AS "propertyName",
        room."name" AS "roomName"
      FROM "CalendarSource" source
      JOIN "Room" room ON room."id" = source."roomId"
      JOIN "Property" property ON property."id" = room."propertyId"
      JOIN "Company" company ON company."id" = property."companyId"
      WHERE source."isActive" = true
        AND source."provider" IN ('AIRBNB', 'BOOKING', 'AGODA')
      ORDER BY company."name", property."name", room."name", source."provider"
    `);
    const candidates: CleanupCandidate[] = [];
    const blockedEvents: BlockedEventCandidate[] = [];
    let failedSourceCount = 0;

    for (const source of sourceResult.rows) {
      if (!isSupportedProvider(source.provider)) continue;
      try {
        const content = await downloadCalendar(source.provider, source.calendarUrl);
        const parsed = parseIcsCalendar(content);
        if (parsed.issues.some((issue) => issue.reason !== "DUPLICATE_UID")) throw new Error("IncompleteCalendarParse");
        const classified = classifyCalendarEvents(parsed.events, reservationNormalizerRegistry.get(source.provider), parsed.excludedCount);
        for (const rawUid of classified.blockedUids) blockedEvents.push({ sourceId: source.sourceId, rawUid, provider: source.provider, companyName: source.companyName, propertyName: source.propertyName, roomName: source.roomName });
      } catch (error) {
        failedSourceCount += 1;
        const errorLabel = error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError";
        console.error(`${source.companyName} / ${source.propertyName} / ${source.roomName} / ${source.provider}: ${errorLabel}`);
      }
    }

    if (blockedEvents.length) {
      const metadataByEvent = new Map(blockedEvents.map((item) => [`${item.sourceId}\u0000${item.rawUid}`, item]));
      const reservationResult = await client.query<{ id: string; sourceId: string; rawUid: string }>(`
        SELECT reservation."id", reservation."calendarSourceId" AS "sourceId", reservation."rawUid" AS "rawUid"
        FROM "Reservation" reservation
        JOIN jsonb_to_recordset($1::jsonb) AS blocked("sourceId" text, "rawUid" text)
          ON blocked."sourceId" = reservation."calendarSourceId"
          AND blocked."rawUid" = reservation."rawUid"
        WHERE reservation."status" <> 'CANCELLED'
        ORDER BY reservation."id"
      `, [JSON.stringify(blockedEvents.map(({ sourceId, rawUid }) => ({ sourceId, rawUid })))]);
      for (const reservation of reservationResult.rows) {
        const metadata = metadataByEvent.get(`${reservation.sourceId}\u0000${reservation.rawUid}`);
        if (metadata) candidates.push({ id: reservation.id, provider: metadata.provider, companyName: metadata.companyName, propertyName: metadata.propertyName, roomName: metadata.roomName });
      }
    }

    printSummary(candidates, sourceResult.rows.length, failedSourceCount, apply);
    if (!apply) return;
    if (!candidates.length) return;

    const candidateIds = candidates.map((candidate) => candidate.id);
    await client.query("BEGIN");
    try {
      await client.query(`UPDATE "Reservation" SET "status" = 'CANCELLED', "updatedAt" = NOW() WHERE "id" = ANY($1::text[]) AND "status" <> 'CANCELLED'`, [candidateIds]);
      await client.query(`UPDATE "ReservationConflict" SET "status" = 'RESOLVED', "resolvedAt" = NOW(), "updatedAt" = NOW() WHERE "status" = 'ACTIVE' AND ("reservationAId" = ANY($1::text[]) OR "reservationBId" = ANY($1::text[]))`, [candidateIds]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "정리 스크립트를 실행하지 못했습니다.");
  process.exitCode = 1;
});
