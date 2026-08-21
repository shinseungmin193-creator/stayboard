import { createHash } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

const DEFAULT_ROOM_IDENTIFIERS = ["505", "203", "207", "211", "303", "410", "501", "804", "403", "206"] as const;

interface RoomRow {
  roomId: string;
  roomName: string;
  roomCode: string;
  propertyName: string;
}

interface SourceRow {
  sourceId: string;
  roomId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  calendarUrl: string;
  reservationCount: number;
  latestSyncLogId: string | null;
  latestSyncStatus: string | null;
  latestSyncStartedAt: Date | null;
  latestSyncCompletedAt: Date | null;
}

interface AuditRow {
  createdAt: Date;
  details: Record<string, unknown> | null;
}

interface ConflictRow {
  conflictId: string;
  roomId: string;
  overlapStart: Date;
  overlapEnd: Date;
  aId: string;
  aProvider: string;
  aCalendarSourceId: string;
  aSourceActive: boolean;
  aStartDate: Date;
  aEndDate: Date;
  aStatus: string;
  aSummary: string | null;
  aDescription: string | null;
  aRawUid: string;
  aCreatedAt: Date;
  aCreatedBySyncLogId: string | null;
  bId: string;
  bProvider: string;
  bCalendarSourceId: string;
  bSourceActive: boolean;
  bStartDate: Date;
  bEndDate: Date;
  bStatus: string;
  bSummary: string | null;
  bDescription: string | null;
  bRawUid: string;
  bCreatedAt: Date;
  bCreatedBySyncLogId: string | null;
}

interface SyncEvidenceRow {
  syncLogId: string;
  calendarSourceId: string;
  startedAt: Date;
  completedAt: Date | null;
  eventDiagnostics: unknown;
}

interface SafeEventEvidence {
  startDate: string;
  endDate: string;
  status: string | null;
  summaryPreview: string | null;
  descriptionPresent: boolean;
  classification: string;
  exclusionReason: string | null;
}

const SAFE_CLASSIFICATIONS = new Set(["RESERVATION", "BLOCKED", "CANCELLED", "UNKNOWN"]);
const SAFE_DIAGNOSTIC_SUMMARIES = /^(?:airbnb(?:\s*\(not available\))?|agoda reservation|stay\s*-\s*booking\.com|closed(?:\s*-\s*not available)?|not available|unavailable|reserved|reservation|booking|blocked|maintenance|owner use|stop sell|room closed|restrictions|calendar blocked|owner block(?:ed)?|booking canc?elled|cancelled|canceled)$/i;

function parseRoomIdentifiers(): string[] {
  const roomArgument = process.argv.find((argument) => argument.startsWith("--rooms="));
  const invalidArguments = process.argv.slice(2).filter((argument) => !argument.startsWith("--rooms="));
  if (invalidArguments.length) throw new Error("지원하지 않는 인자가 있습니다. --rooms=505,203 형식만 사용할 수 있습니다.");
  const identifiers = roomArgument
    ? roomArgument.slice("--rooms=".length).split(",").map((value) => value.trim()).filter(Boolean)
    : [...DEFAULT_ROOM_IDENTIFIERS];
  if (!identifiers.length || identifiers.some((value) => value.length > 40)) throw new Error("객실 식별자를 확인해 주세요.");
  return [...new Set(identifiers)];
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function uidFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function privateTextFingerprint(value: string | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value.normalize("NFKC").trim()).digest("hex").slice(0, 12);
}

function uidShape(value: string) {
  const atIndex = value.lastIndexOf("@");
  return {
    length: value.length,
    format: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? "UUID"
      : /^[0-9a-f]+$/i.test(value)
        ? "HEX"
        : atIndex > 0
          ? "AT_DOMAIN"
          : /^[A-Za-z0-9_-]+$/.test(value)
            ? "OPAQUE"
            : "OTHER",
    domain: atIndex > 0 ? value.slice(atIndex + 1).toLocaleLowerCase("en-US") : null,
  };
}

function safeUrlDetails(calendarUrl: string) {
  try {
    const url = new URL(calendarUrl);
    return {
      hostname: url.hostname.toLocaleLowerCase("en-US"),
      queryNames: [...new Set(url.searchParams.keys())].sort(),
      token: url.searchParams.has("t") ? "[masked]" : null,
    };
  } catch {
    return { hostname: "[invalid]", queryNames: [] as string[], token: null };
  }
}

function detailsString(details: Record<string, unknown> | null, key: string): string | null {
  const value = details?.[key];
  return typeof value === "string" ? value : null;
}

function detailsCount(details: Record<string, unknown> | null, key: string): number | null {
  const value = details?.[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeDiagnosticEvents(value: unknown): SafeEventEvidence[] {
  if (!isRecord(value) || !Array.isArray(value.events)) return [];
  return value.events.flatMap((item): SafeEventEvidence[] => {
    if (!isRecord(item) || !SAFE_CLASSIFICATIONS.has(String(item.classification))) return [];
    const startDate = typeof item.startDate === "string" && Number.isFinite(Date.parse(item.startDate)) ? new Date(item.startDate).toISOString() : "";
    const endDate = typeof item.endDate === "string" && Number.isFinite(Date.parse(item.endDate)) ? new Date(item.endDate).toISOString() : "";
    const rawSummary = typeof item.summaryPreview === "string" ? item.summaryPreview.normalize("NFKC").trim().slice(0, 120) : null;
    const summaryPreview = rawSummary && SAFE_DIAGNOSTIC_SUMMARIES.test(rawSummary) ? rawSummary : rawSummary ? "[private]" : null;
    const status = typeof item.status === "string" && /^[A-Z_-]{1,30}$/.test(item.status) ? item.status : null;
    const exclusionReason = typeof item.exclusionReason === "string" && /^[A-Z_]+$/.test(item.exclusionReason) ? item.exclusionReason : null;
    return [{ startDate, endDate, status, summaryPreview, descriptionPresent: item.descriptionPresent === true, classification: String(item.classification), exclusionReason }];
  });
}

function diagnosticEvidence(
  logs: readonly SyncEvidenceRow[],
  reservation: { calendarSourceId: string; createdBySyncLogId: string | null; createdAt: Date; startDate: Date; endDate: Date },
) {
  const exactLog = reservation.createdBySyncLogId ? logs.find((log) => log.syncLogId === reservation.createdBySyncLogId) : null;
  const inferredLog = exactLog ?? logs.find((log) => (
    log.calendarSourceId === reservation.calendarSourceId
    && log.startedAt.getTime() <= reservation.createdAt.getTime() + 60_000
    && (log.completedAt?.getTime() ?? log.startedAt.getTime()) + 60_000 >= reservation.createdAt.getTime()
  ));
  if (!inferredLog) return null;
  const availableEvents = safeDiagnosticEvents(inferredLog.eventDiagnostics);
  const matchingEvents = availableEvents.filter((event) => (
    event.startDate === reservation.startDate.toISOString() && event.endDate === reservation.endDate.toISOString()
  ));
  return {
    syncLogId: inferredLog.syncLogId,
    matchMethod: exactLog ? "EXACT" : "LEGACY_TIME_WINDOW",
    availableEventCount: availableEvents.length,
    exactRangeMatch: matchingEvents.length > 0,
    events: matchingEvents.length ? matchingEvents : availableEvents,
  };
}

function hasValidOverlap(row: ConflictRow): boolean {
  return row.aStartDate < row.bEndDate && row.aEndDate > row.bStartDate;
}

function operationalTextSignals(...values: Array<string | null>): string[] {
  const text = values.filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("en-US");
  const signals = ["imported", "external", "blocked", "unavailable", "not available", "closed", "reservation", "booking", "airbnb", "agoda", "calendar"];
  return signals.filter((signal) => text.includes(signal));
}

function classifyConflict(row: ConflictRow, bookingSourceCount: number): string {
  if (!row.aSourceActive || !row.bSourceActive || !hasValidOverlap(row)) return "STALE_RESERVATION";
  if (row.aStartDate >= row.aEndDate || row.bStartDate >= row.bEndDate) return "DATE_PARSE_ERROR";
  if (row.aCalendarSourceId === row.bCalendarSourceId) return "SAME_SOURCE_DUPLICATE";
  if (bookingSourceCount > 1 && row.aProvider === "BOOKING" && row.bProvider === "BOOKING") return "OLD_BOOKING_SOURCE_REMAINS";
  return "UNKNOWN";
}

function conflictReservation(row: ConflictRow, side: "a" | "b") {
  return side === "a"
    ? {
        reservationId: row.aId,
        provider: row.aProvider,
        calendarSourceId: row.aCalendarSourceId,
        sourceActive: row.aSourceActive,
        startDate: iso(row.aStartDate),
        endDate: iso(row.aEndDate),
        status: row.aStatus,
        rawUidHash: uidFingerprint(row.aRawUid),
        rawUidShape: uidShape(row.aRawUid),
        createdAt: iso(row.aCreatedAt),
        createdBySyncLogId: row.aCreatedBySyncLogId,
        operationalTextSignals: operationalTextSignals(row.aSummary, row.aDescription),
        summaryHash: privateTextFingerprint(row.aSummary),
        descriptionHash: privateTextFingerprint(row.aDescription),
        summaryLength: row.aSummary?.length ?? 0,
        descriptionLength: row.aDescription?.length ?? 0,
        summaryEqualsDescription: Boolean(row.aSummary && row.aSummary === row.aDescription),
      }
    : {
        reservationId: row.bId,
        provider: row.bProvider,
        calendarSourceId: row.bCalendarSourceId,
        sourceActive: row.bSourceActive,
        startDate: iso(row.bStartDate),
        endDate: iso(row.bEndDate),
        status: row.bStatus,
        rawUidHash: uidFingerprint(row.bRawUid),
        rawUidShape: uidShape(row.bRawUid),
        createdAt: iso(row.bCreatedAt),
        createdBySyncLogId: row.bCreatedBySyncLogId,
        operationalTextSignals: operationalTextSignals(row.bSummary, row.bDescription),
        summaryHash: privateTextFingerprint(row.bSummary),
        descriptionHash: privateTextFingerprint(row.bDescription),
        summaryLength: row.bSummary?.length ?? 0,
        descriptionLength: row.bDescription?.length ?? 0,
        summaryEqualsDescription: Boolean(row.bSummary && row.bSummary === row.bDescription),
      };
}

async function main(): Promise<void> {
  const roomIdentifiers = parseRoomIdentifiers();
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 환경 변수가 필요합니다.");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const rooms = (await client.query<RoomRow>(`
      SELECT room.id AS "roomId", room.name AS "roomName", room.code AS "roomCode", property.name AS "propertyName"
      FROM "Room" room
      JOIN "Property" property ON property.id = room."propertyId"
      WHERE room.name = ANY($1::text[]) OR room.code = ANY($1::text[])
      ORDER BY property.name, room.name, room.code, room.id
    `, [roomIdentifiers])).rows;
    const roomIds = rooms.map((room) => room.roomId);

    const sources = roomIds.length ? (await client.query<SourceRow>(`
      SELECT
        source.id AS "sourceId",
        source."roomId" AS "roomId",
        source."isActive" AS "isActive",
        source."createdAt" AS "createdAt",
        source."updatedAt" AS "updatedAt",
        source."calendarUrl" AS "calendarUrl",
        (SELECT COUNT(*)::int FROM "Reservation" reservation WHERE reservation."calendarSourceId" = source.id) AS "reservationCount",
        latest.id AS "latestSyncLogId",
        latest.status::text AS "latestSyncStatus",
        latest."startedAt" AS "latestSyncStartedAt",
        latest."completedAt" AS "latestSyncCompletedAt"
      FROM "CalendarSource" source
      LEFT JOIN LATERAL (
        SELECT log.id, log.status, log."startedAt", log."completedAt"
        FROM "SyncLog" log
        WHERE log."calendarSourceId" = source.id
        ORDER BY log."createdAt" DESC, log.id DESC
        LIMIT 1
      ) latest ON TRUE
      WHERE source."roomId" = ANY($1::text[]) AND source.provider = 'BOOKING'
      ORDER BY source."roomId", source."createdAt", source.id
    `, [roomIds])).rows : [];

    const audits = roomIds.length ? (await client.query<AuditRow>(`
      SELECT audit."createdAt" AS "createdAt", audit.details AS details
      FROM "AuditLog" audit
      WHERE audit.action = 'CALENDAR_SOURCE_DELETED'
        AND audit.details->>'roomId' = ANY($1::text[])
        AND audit.details->>'provider' = 'BOOKING'
      ORDER BY audit."createdAt" DESC, audit.id DESC
    `, [roomIds])).rows : [];

    const conflicts = roomIds.length ? (await client.query<ConflictRow>(`
      SELECT
        conflict.id AS "conflictId",
        conflict."roomId" AS "roomId",
        conflict."overlapStart" AS "overlapStart",
        conflict."overlapEnd" AS "overlapEnd",
        a.id AS "aId",
        a.provider::text AS "aProvider",
        a."calendarSourceId" AS "aCalendarSourceId",
        source_a."isActive" AS "aSourceActive",
        a."startDate" AS "aStartDate",
        a."endDate" AS "aEndDate",
        a.status::text AS "aStatus",
        a.summary AS "aSummary",
        a.description AS "aDescription",
        a."rawUid" AS "aRawUid",
        a."createdAt" AS "aCreatedAt",
        a."createdBySyncLogId" AS "aCreatedBySyncLogId",
        b.id AS "bId",
        b.provider::text AS "bProvider",
        b."calendarSourceId" AS "bCalendarSourceId",
        source_b."isActive" AS "bSourceActive",
        b."startDate" AS "bStartDate",
        b."endDate" AS "bEndDate",
        b.status::text AS "bStatus",
        b.summary AS "bSummary",
        b.description AS "bDescription",
        b."rawUid" AS "bRawUid",
        b."createdAt" AS "bCreatedAt",
        b."createdBySyncLogId" AS "bCreatedBySyncLogId"
      FROM "ReservationConflict" conflict
      JOIN "Reservation" a ON a.id = conflict."reservationAId"
      JOIN "Reservation" b ON b.id = conflict."reservationBId"
      JOIN "CalendarSource" source_a ON source_a.id = a."calendarSourceId"
      JOIN "CalendarSource" source_b ON source_b.id = b."calendarSourceId"
      WHERE conflict.status = 'ACTIVE' AND conflict."roomId" = ANY($1::text[])
      ORDER BY conflict."roomId", conflict."overlapStart", conflict.id
    `, [roomIds])).rows : [];

    const conflictSourceIds = [...new Set(conflicts.flatMap((conflict) => [conflict.aCalendarSourceId, conflict.bCalendarSourceId]))];
    const evidenceLogs = conflictSourceIds.length ? (await client.query<SyncEvidenceRow>(`
      SELECT
        log.id AS "syncLogId",
        log."calendarSourceId" AS "calendarSourceId",
        log."startedAt" AS "startedAt",
        log."completedAt" AS "completedAt",
        log."eventDiagnostics" AS "eventDiagnostics"
      FROM "SyncLog" log
      WHERE log."calendarSourceId" = ANY($1::text[])
      ORDER BY log."startedAt" DESC, log.id DESC
    `, [conflictSourceIds])).rows : [];

    const sourcesByRoom = new Map<string, SourceRow[]>();
    for (const source of sources) sourcesByRoom.set(source.roomId, [...(sourcesByRoom.get(source.roomId) ?? []), source]);
    const auditsByRoom = new Map<string, AuditRow[]>();
    for (const audit of audits) {
      const roomId = detailsString(audit.details, "roomId");
      if (roomId) auditsByRoom.set(roomId, [...(auditsByRoom.get(roomId) ?? []), audit]);
    }
    const conflictsByRoom = new Map<string, ConflictRow[]>();
    for (const conflict of conflicts) conflictsByRoom.set(conflict.roomId, [...(conflictsByRoom.get(conflict.roomId) ?? []), conflict]);

    console.log(JSON.stringify({ mode: "READ_ONLY", requestedRooms: roomIdentifiers, matchedRoomCount: rooms.length }));
    for (const room of rooms) {
      const roomSources = sourcesByRoom.get(room.roomId) ?? [];
      const roomAudits = auditsByRoom.get(room.roomId) ?? [];
      const roomConflicts = conflictsByRoom.get(room.roomId) ?? [];
      console.log(JSON.stringify({
        room: { roomId: room.roomId, roomName: room.roomName, roomCode: room.roomCode, propertyName: room.propertyName },
        bookingSources: roomSources.map((source) => ({
          sourceId: source.sourceId,
          isActive: source.isActive,
          createdAt: iso(source.createdAt),
          updatedAt: iso(source.updatedAt),
          url: safeUrlDetails(source.calendarUrl),
          reservationCount: source.reservationCount,
          latestSyncLog: source.latestSyncLogId ? {
            id: source.latestSyncLogId,
            status: source.latestSyncStatus,
            startedAt: iso(source.latestSyncStartedAt),
            completedAt: iso(source.latestSyncCompletedAt),
          } : null,
        })),
        oldBookingSourceRemains: roomSources.length > 1,
        deletionAudits: roomAudits.map((audit) => ({
          calendarSourceId: detailsString(audit.details, "calendarSourceId"),
          roomId: detailsString(audit.details, "roomId"),
          provider: detailsString(audit.details, "provider"),
          reservationCount: detailsCount(audit.details, "reservationCount"),
          conflictCount: detailsCount(audit.details, "conflictCount"),
          syncLogCount: detailsCount(audit.details, "syncLogCount"),
          deletedAt: iso(audit.createdAt),
        })),
        activeConflicts: roomConflicts.map((conflict) => ({
          conflictId: conflict.conflictId,
          classification: classifyConflict(conflict, roomSources.length),
          a: {
            ...conflictReservation(conflict, "a"),
            creationEvidence: diagnosticEvidence(evidenceLogs, {
              calendarSourceId: conflict.aCalendarSourceId,
              createdBySyncLogId: conflict.aCreatedBySyncLogId,
              createdAt: conflict.aCreatedAt,
              startDate: conflict.aStartDate,
              endDate: conflict.aEndDate,
            }),
          },
          b: {
            ...conflictReservation(conflict, "b"),
            creationEvidence: diagnosticEvidence(evidenceLogs, {
              calendarSourceId: conflict.bCalendarSourceId,
              createdBySyncLogId: conflict.bCreatedBySyncLogId,
              createdAt: conflict.bCreatedAt,
              startDate: conflict.bStartDate,
              endDate: conflict.bEndDate,
            }),
          },
          overlap: { startDate: iso(conflict.overlapStart), endDate: iso(conflict.overlapEnd) },
        })),
      }));
    }
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "진단을 실행하지 못했습니다.");
  process.exitCode = 1;
});
