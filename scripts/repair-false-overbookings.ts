import { createHash, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { classifyConflicts } from "../src/features/reservation-conflicts/domain/classify-conflicts";
import { findReservationConflictPairs, type ConflictCandidate } from "../src/features/reservation-conflicts/domain/reservation-conflict";
import { parseIcsCalendar } from "../src/features/calendar-sync/infrastructure/ics-parser";
import { reservationNormalizerRegistry } from "../src/features/calendar-sync/providers/normalizer-registry";
import { classifyStoredCalendarEvent } from "../src/features/calendar-sync/providers/reservation-normalizer";
import { ICS_MAX_REDIRECTS, ICS_MAX_RESPONSE_BYTES, PROVIDER_HOSTS } from "../src/providers/calendar/constants";
import { isCalendarProviderType, type CalendarProviderType } from "../src/providers/calendar/types";

type RepairReason = "MISCLASSIFIED_BLOCKED" | "STALE_MISSING_UID";

interface SourceRow {
  sourceId: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  propertyName: string;
  provider: string;
  calendarUrl: string;
}

interface ReservationRow {
  id: string;
  provider: string;
  roomId: string;
  calendarSourceId: string;
  rawUid: string;
  startDate: Date;
  endDate: Date;
  status: "CONFIRMED" | "CANCELLED" | "BLOCKED" | "TENTATIVE" | "UNKNOWN";
  summary: string | null;
  description: string | null;
}

interface ConflictRow {
  id: string;
  roomId: string;
  reservationAId: string;
  reservationBId: string;
  status: "ACTIVE" | "RESOLVED";
  overlapStart: Date;
  overlapEnd: Date;
}

interface RepairCandidate {
  reservation: ReservationRow;
  source: SourceRow;
  reason: RepairReason;
  observedCounterpartId: string | null;
}

interface ParsedArguments {
  apply: boolean;
  roomIdentifiers: string[];
}

function parseArguments(): ParsedArguments {
  const argumentsSet = new Set(process.argv.slice(2));
  const invalid = [...argumentsSet].filter((argument) => argument !== "--apply" && !argument.startsWith("--rooms="));
  if (invalid.length) throw new Error("지원하지 않는 인자가 있습니다. --apply와 --rooms=505,203만 사용할 수 있습니다.");
  const roomArgument = [...argumentsSet].find((argument) => argument.startsWith("--rooms="));
  const roomIdentifiers = roomArgument
    ? roomArgument.slice("--rooms=".length).split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  if (roomIdentifiers.some((value) => value.length > 40)) throw new Error("객실 식별자를 확인해 주세요.");
  return { apply: argumentsSet.has("--apply"), roomIdentifiers: [...new Set(roomIdentifiers)] };
}

function uidFingerprint(rawUid: string): string {
  return createHash("sha256").update(rawUid).digest("hex").slice(0, 12);
}

function assertSafeCalendarUrl(provider: CalendarProviderType, value: string): URL {
  const url = new URL(value);
  const allowedHosts = PROVIDER_HOSTS[provider] as readonly string[];
  if (url.protocol !== "https:" || url.username || url.password || !allowedHosts.includes(url.hostname.toLocaleLowerCase("en-US"))) {
    throw new Error("UnsafeCalendarUrl");
  }
  return url;
}

async function discardBody(response: Response): Promise<void> {
  if (response.body) await response.body.cancel();
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
  let current = assertSafeCalendarUrl(provider, calendarUrl);
  for (let redirectCount = 0; redirectCount <= ICS_MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "text/calendar,text/plain;q=0.9,application/octet-stream;q=0.8", "User-Agent": "StayBoard-Calendar-Repair/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await discardBody(response);
      if (!location || redirectCount === ICS_MAX_REDIRECTS) throw new Error("UnsafeCalendarRedirect");
      current = assertSafeCalendarUrl(provider, new URL(location, current).toString());
      continue;
    }
    if (!response.ok) {
      await discardBody(response);
      throw new Error(`CalendarHttp${response.status}`);
    }
    const content = (await readLimitedBody(response)).replace(/^\uFEFF/u, "").trim();
    if (!content.includes("BEGIN:VCALENDAR") || !content.includes("END:VCALENDAR")) throw new Error("InvalidCalendarDocument");
    return content;
  }
  throw new Error("UnsafeCalendarRedirect");
}

function classifyStoredReservation(reservation: ReservationRow): ReturnType<typeof classifyStoredCalendarEvent> {
  if (!isCalendarProviderType(reservation.provider)) return "UNKNOWN";
  return classifyStoredCalendarEvent(reservationNormalizerRegistry.get(reservation.provider), reservation);
}

function findCandidates(input: {
  sources: readonly SourceRow[];
  reservations: readonly ReservationRow[];
  conflicts: readonly ConflictRow[];
  observedUidsBySource: ReadonlyMap<string, ReadonlySet<string>>;
}): RepairCandidate[] {
  const sourceById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const reservationById = new Map(input.reservations.map((reservation) => [reservation.id, reservation]));
  const candidates = new Map<string, RepairCandidate>();

  for (const reservation of input.reservations) {
    if (reservation.status !== "CONFIRMED" && reservation.status !== "TENTATIVE") continue;
    const source = sourceById.get(reservation.calendarSourceId);
    if (source && classifyStoredReservation(reservation) === "BLOCKED") {
      candidates.set(reservation.id, { reservation, source, reason: "MISCLASSIFIED_BLOCKED", observedCounterpartId: null });
    }
  }

  for (const conflict of input.conflicts) {
    if (conflict.status !== "ACTIVE") continue;
    const left = reservationById.get(conflict.reservationAId);
    const right = reservationById.get(conflict.reservationBId);
    if (!left || !right || left.calendarSourceId !== right.calendarSourceId) continue;
    const source = sourceById.get(left.calendarSourceId);
    const observedUids = input.observedUidsBySource.get(left.calendarSourceId);
    if (!source || !observedUids) continue;
    for (const [missing, counterpart] of [[left, right], [right, left]] as const) {
      if (candidates.has(missing.id) || missing.status === "CANCELLED" || missing.status === "BLOCKED") continue;
      if (!observedUids.has(missing.rawUid) && observedUids.has(counterpart.rawUid)) {
        candidates.set(missing.id, { reservation: missing, source, reason: "STALE_MISSING_UID", observedCounterpartId: counterpart.id });
      }
    }
  }
  return [...candidates.values()].sort((left, right) => left.source.propertyName.localeCompare(right.source.propertyName, "ko") || left.source.roomName.localeCompare(right.source.roomName, "ko", { numeric: true }) || left.reservation.startDate.getTime() - right.reservation.startDate.getTime() || left.reservation.id.localeCompare(right.reservation.id));
}

function candidateStatus(candidate: RepairCandidate): ConflictCandidate["status"] {
  return candidate.reason === "MISCLASSIFIED_BLOCKED" ? "BLOCKED" : "CANCELLED";
}

function previewRooms(reservations: readonly ReservationRow[], conflicts: readonly ConflictRow[], candidates: readonly RepairCandidate[]) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.reservation.id, candidate]));
  const roomIds = [...new Set(candidates.map((candidate) => candidate.reservation.roomId))];
  return roomIds.map((roomId) => {
    const roomReservations = reservations.filter((reservation) => reservation.roomId === roomId).map((reservation): ConflictCandidate => ({
      id: reservation.id,
      roomId: reservation.roomId,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      status: candidateById.has(reservation.id) ? candidateStatus(candidateById.get(reservation.id)!) : reservation.status,
    }));
    const existing = conflicts.filter((conflict) => conflict.roomId === roomId);
    const detected = findReservationConflictPairs(roomReservations);
    const classification = classifyConflicts(existing, detected);
    return {
      roomId,
      currentActiveConflictCount: existing.filter((conflict) => conflict.status === "ACTIVE").length,
      nextActiveConflictCount: detected.length,
      resolveIds: classification.resolveIds,
      createCount: classification.create.length,
    };
  });
}

async function lockRepairScope(client: Client, sources: readonly SourceRow[], roomIds: readonly string[]): Promise<void> {
  const keys = [...new Set([
    ...sources.map((source) => `calendar-source:${source.sourceId}`),
    ...roomIds.map((roomId) => `reservation-conflicts-room:${roomId}`),
  ])].sort();
  for (const key of keys) {
    const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired", [key]);
    if (result.rows[0]?.acquired !== true) throw new Error("동기화 중인 CalendarSource 또는 객실이 있어 repair를 중단했습니다.");
  }
}

async function recalculateRoomConflicts(client: Client, roomId: string): Promise<void> {
  const reservations = (await client.query<ReservationRow>(`
    SELECT reservation.id, reservation.provider::text AS provider, reservation."roomId", reservation."calendarSourceId", reservation."rawUid",
      reservation."startDate", reservation."endDate", reservation.status::text AS status, reservation.summary, reservation.description
    FROM "Reservation" reservation
    JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
    WHERE reservation."roomId" = $1 AND source."isActive" = true
      AND reservation.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
      AND reservation.status IN ('CONFIRMED', 'TENTATIVE')
    ORDER BY reservation."startDate", reservation."endDate", reservation.id
  `, [roomId])).rows;
  const existing = (await client.query<ConflictRow>(`
    SELECT id, "roomId", "reservationAId", "reservationBId", status::text AS status, "overlapStart", "overlapEnd"
    FROM "ReservationConflict" WHERE "roomId" = $1 ORDER BY id
  `, [roomId])).rows;
  const detected = findReservationConflictPairs(reservations.map((reservation) => ({ id: reservation.id, roomId, startDate: reservation.startDate, endDate: reservation.endDate, status: reservation.status })));
  const classification = classifyConflicts(existing, detected);
  const now = new Date();
  for (const pair of classification.create) {
    await client.query(`
      INSERT INTO "ReservationConflict" (id, "roomId", "reservationAId", "reservationBId", status, "overlapStart", "overlapEnd", "detectedAt", "lastDetectedAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, $7, $7, $7)
    `, [`repair_${randomUUID()}`, pair.roomId, pair.reservationAId, pair.reservationBId, pair.overlapStart, pair.overlapEnd, now]);
  }
  for (const item of classification.refresh) {
    await client.query(`
      UPDATE "ReservationConflict"
      SET status = 'ACTIVE', "overlapStart" = $2, "overlapEnd" = $3, "lastDetectedAt" = $4,
        "resolvedAt" = NULL, "updatedAt" = $4
      WHERE id = $1
    `, [item.id, item.pair.overlapStart, item.pair.overlapEnd, now]);
  }
  if (classification.resolveIds.length) {
    await client.query(`
      UPDATE "ReservationConflict"
      SET status = 'RESOLVED', "resolvedAt" = $2, "updatedAt" = $2
      WHERE id = ANY($1::text[]) AND status = 'ACTIVE'
    `, [classification.resolveIds, now]);
  }
}

function printReport(input: {
  apply: boolean;
  sources: readonly SourceRow[];
  failedSources: readonly SourceRow[];
  candidates: readonly RepairCandidate[];
  roomPreviews: ReturnType<typeof previewRooms>;
}): void {
  console.log(`모드: ${input.apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`검사 source: ${input.sources.length}개 · feed 확인 실패: ${input.failedSources.length}개`);
  for (const candidate of input.candidates) {
    console.log(JSON.stringify({
      reservationId: candidate.reservation.id,
      reason: candidate.reason,
      property: candidate.source.propertyName,
      room: candidate.source.roomName,
      provider: candidate.source.provider,
      calendarSourceId: candidate.source.sourceId,
      startDate: candidate.reservation.startDate.toISOString(),
      endDate: candidate.reservation.endDate.toISOString(),
      rawUidHash: uidFingerprint(candidate.reservation.rawUid),
      observedCounterpartId: candidate.observedCounterpartId,
    }));
  }
  for (const preview of input.roomPreviews) console.log(JSON.stringify(preview));
  console.log(`정리 대상: ${input.candidates.length}건 · RESOLVED 예정 conflict: ${input.roomPreviews.reduce((sum, room) => sum + room.resolveIds.length, 0)}건`);
  if (!input.apply) console.log("실제 데이터는 변경하지 않았습니다. 검토 후 같은 명령에 --apply를 추가해야만 반영됩니다.");
}

async function main(): Promise<void> {
  const parsedArguments = parseArguments();
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const sources = (await client.query<SourceRow>(`
      SELECT source.id AS "sourceId", source."roomId", room.name AS "roomName", room.code AS "roomCode",
        property.name AS "propertyName", source.provider::text AS provider, source."calendarUrl"
      FROM "CalendarSource" source
      JOIN "Room" room ON room.id = source."roomId"
      JOIN "Property" property ON property.id = room."propertyId"
      WHERE source."isActive" = true
        AND source.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
        AND ($1::text[] = '{}'::text[] OR room.name = ANY($1::text[]) OR room.code = ANY($1::text[]))
        AND EXISTS (
          SELECT 1 FROM "ReservationConflict" conflict
          JOIN "Reservation" a ON a.id = conflict."reservationAId"
          JOIN "Reservation" b ON b.id = conflict."reservationBId"
          WHERE conflict.status = 'ACTIVE' AND conflict."roomId" = source."roomId"
            AND (a."calendarSourceId" = source.id OR b."calendarSourceId" = source.id)
        )
      ORDER BY property.name, room.name, source.provider, source.id
    `, [parsedArguments.roomIdentifiers])).rows;
    const sourceIds = sources.map((source) => source.sourceId);
    const roomIds = [...new Set(sources.map((source) => source.roomId))];
    const reservations = sourceIds.length ? (await client.query<ReservationRow>(`
      SELECT reservation.id, reservation.provider::text AS provider, reservation."roomId", reservation."calendarSourceId", reservation."rawUid",
        reservation."startDate", reservation."endDate", reservation.status::text AS status, reservation.summary, reservation.description
      FROM "Reservation" reservation
      JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
      WHERE source."roomId" = ANY($1::text[]) AND source."isActive" = true
        AND reservation.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
      ORDER BY reservation."roomId", reservation."startDate", reservation.id
    `, [roomIds])).rows : [];
    const conflicts = roomIds.length ? (await client.query<ConflictRow>(`
      SELECT id, "roomId", "reservationAId", "reservationBId", status::text AS status, "overlapStart", "overlapEnd"
      FROM "ReservationConflict" WHERE "roomId" = ANY($1::text[]) ORDER BY "roomId", id
    `, [roomIds])).rows : [];

    const observedUidsBySource = new Map<string, ReadonlySet<string>>();
    const failedSources: SourceRow[] = [];
    for (const source of sources) {
      if (!isCalendarProviderType(source.provider)) continue;
      try {
        const parsed = parseIcsCalendar(await downloadCalendar(source.provider, source.calendarUrl));
        if (parsed.issues.some((issue) => issue.reason !== "DUPLICATE_UID")) throw new Error("IncompleteCalendarParse");
        observedUidsBySource.set(source.sourceId, new Set(parsed.events.map((event) => event.uid)));
      } catch {
        failedSources.push(source);
      }
    }

    const candidates = findCandidates({ sources, reservations, conflicts, observedUidsBySource });
    const roomPreviews = previewRooms(reservations, conflicts, candidates);
    printReport({ apply: parsedArguments.apply, sources, failedSources, candidates, roomPreviews });
    if (!parsedArguments.apply || !candidates.length) return;

    await client.query("BEGIN");
    try {
      const affectedRoomIds = [...new Set(candidates.map((candidate) => candidate.reservation.roomId))];
      const affectedSources = sources.filter((source) => candidates.some((candidate) => candidate.source.sourceId === source.sourceId));
      await lockRepairScope(client, affectedSources, affectedRoomIds);
      const lockedRows = (await client.query<{ id: string; rawUid: string; status: string }>(`
        SELECT id, "rawUid", status::text AS status FROM "Reservation"
        WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE
      `, [candidates.map((candidate) => candidate.reservation.id)])).rows;
      const expectedById = new Map(candidates.map((candidate) => [candidate.reservation.id, candidate]));
      if (lockedRows.length !== candidates.length || lockedRows.some((row) => {
        const expected = expectedById.get(row.id);
        return !expected || expected.reservation.rawUid !== row.rawUid || (row.status !== "CONFIRMED" && row.status !== "TENTATIVE");
      })) throw new Error("repair 대상 데이터가 dry-run 이후 변경되어 반영을 중단했습니다.");

      const blockedIds = candidates.filter((candidate) => candidate.reason === "MISCLASSIFIED_BLOCKED").map((candidate) => candidate.reservation.id);
      const staleIds = candidates.filter((candidate) => candidate.reason === "STALE_MISSING_UID").map((candidate) => candidate.reservation.id);
      if (blockedIds.length) await client.query(`UPDATE "Reservation" SET status = 'BLOCKED', "updatedAt" = NOW() WHERE id = ANY($1::text[])`, [blockedIds]);
      if (staleIds.length) await client.query(`UPDATE "Reservation" SET status = 'CANCELLED', "updatedAt" = NOW() WHERE id = ANY($1::text[])`, [staleIds]);
      for (const roomId of affectedRoomIds) await recalculateRoomConflicts(client, roomId);
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
  console.error(error instanceof Error ? error.message : "repair를 실행하지 못했습니다.");
  process.exitCode = 1;
});
