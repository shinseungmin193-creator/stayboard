import { loadEnvConfig } from "@next/env";
import { Client, type QueryResultRow } from "pg";
import {
  getZonedDateInput,
  getZonedMidnight,
  isValidDateInput,
  shiftDateInput,
} from "../src/lib/zoned-date";

const SAMPLE_LIMIT = 20;
const MASS_ORPHAN_REPAIR_THRESHOLD = 100;
const SUPPORTED_PROVIDERS = "'AIRBNB', 'BOOKING', 'AGODA'";
const ACTIVE_RESERVATION_STATUSES = "'CONFIRMED', 'TENTATIVE'";

type AuditSample = Record<string, unknown>;
interface AuditFinding<T extends AuditSample = AuditSample> {
  count: number;
  samples: T[];
}

interface DashboardCounts {
  todayCheckIns: number;
  todayCheckOuts: number;
  priorityCleaning: number;
  flexibleCleaning: number;
  activeCleaning: number;
  completedCleaning: number;
  totalCleaning: number;
  dashboardOverbookings: number;
  detailOverbookings: number;
}

interface RepairResult {
  deletedOrphanCleaningTasks: number;
  cancelledOrphanCleaningTasks: number;
  realignedCleaningTasks: number;
  createdMissingCleaningTasks: number;
  resolvedInvalidConflicts: number;
}

const args = process.argv.slice(2);
const repair = args.includes("--repair");
const dateArg = args.find((argument) => argument.startsWith("--date="));
const orphanConfirmationArg = args.find((argument) => argument.startsWith("--confirm-orphan-count="));
const confirmedOrphanCount = orphanConfirmationArg
  ? Number(orphanConfirmationArg.slice("--confirm-orphan-count=".length))
  : null;
const dateInput = dateArg?.slice("--date=".length) ?? getZonedDateInput(new Date());
const invalidArgs = args.filter((argument) => argument !== "--repair"
  && !argument.startsWith("--date=")
  && !argument.startsWith("--confirm-orphan-count="));
if (invalidArgs.length || !isValidDateInput(dateInput)
  || (confirmedOrphanCount !== null && (!Number.isSafeInteger(confirmedOrphanCount) || confirmedOrphanCount < 0))) {
  throw new Error("--repair, --date=YYYY-MM-DD, --confirm-orphan-count=N만 사용할 수 있습니다.");
}

const todayStart = getZonedMidnight(dateInput);
const todayEnd = getZonedMidnight(shiftDateInput(dateInput, 1));
const conflictFrom = getZonedMidnight(shiftDateInput(dateInput, -30));
const conflictToExclusive = getZonedMidnight(shiftDateInput(dateInput, 181));

function numberValue(value: unknown) {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

async function finding<T extends AuditSample = AuditSample>(
  client: Client,
  sql: string,
  values: readonly unknown[] = [],
): Promise<AuditFinding<T>> {
  const result = await client.query<QueryResultRow>(sql, [...values]);
  const count = result.rows.length ? numberValue(result.rows[0].__total) : 0;
  return {
    count,
    samples: result.rows.map((row) => Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== "__total"),
    ) as T),
  };
}

async function scalar(client: Client, sql: string, values: readonly unknown[] = []) {
  const result = await client.query<{ count: string }>(sql, [...values]);
  return numberValue(result.rows[0]?.count);
}

const operationalReservationSql = `
  reservation.status IN (${ACTIVE_RESERVATION_STATUSES})
  AND reservation.provider IN (${SUPPORTED_PROVIDERS})
  AND source."isActive" = true
  AND room."isActive" = true
  AND property."isActive" = true
  AND company."isActive" = true
  AND reservation."startDate" < reservation."endDate"
`;

const invalidActiveConflictSql = `
  conflict.status = 'ACTIVE'
  AND (
    reservation_a.status NOT IN (${ACTIVE_RESERVATION_STATUSES})
    OR reservation_b.status NOT IN (${ACTIVE_RESERVATION_STATUSES})
    OR reservation_a.provider NOT IN (${SUPPORTED_PROVIDERS})
    OR reservation_b.provider NOT IN (${SUPPORTED_PROVIDERS})
    OR source_a."isActive" = false OR source_b."isActive" = false
    OR room."isActive" = false OR property."isActive" = false OR company."isActive" = false
    OR reservation_a."roomId" <> conflict."roomId"
    OR reservation_b."roomId" <> conflict."roomId"
    OR reservation_a."startDate" >= reservation_a."endDate"
    OR reservation_b."startDate" >= reservation_b."endDate"
    OR reservation_a."startDate" >= reservation_b."endDate"
    OR reservation_a."endDate" <= reservation_b."startDate"
    OR conflict."overlapStart" <> GREATEST(reservation_a."startDate", reservation_b."startDate")
    OR conflict."overlapEnd" <> LEAST(reservation_a."endDate", reservation_b."endDate")
  )
`;

async function collectAudit(client: Client) {
  const reservation = {
    invalidDates: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, "roomId", "calendarSourceId", provider::text, status::text,
        "startDate", "endDate"
      FROM "Reservation"
      WHERE "startDate" >= "endDate"
      ORDER BY id LIMIT ${SAMPLE_LIMIT}
    `),
    duplicateSourceUid: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, "calendarSourceId", "rawUid", COUNT(*)::int AS "rowCount",
        ARRAY_AGG(id ORDER BY id) AS "reservationIds"
      FROM "Reservation"
      GROUP BY "calendarSourceId", "rawUid" HAVING COUNT(*) > 1
      ORDER BY "calendarSourceId", "rawUid" LIMIT ${SAMPLE_LIMIT}
    `),
    duplicateProviderReservationId: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, provider::text, "providerReservationId", COUNT(*)::int AS "rowCount",
        ARRAY_AGG(id ORDER BY id) AS "reservationIds",
        ARRAY_AGG(DISTINCT "calendarSourceId") AS "calendarSourceIds",
        ARRAY_AGG(DISTINCT "roomId") AS "roomIds"
      FROM "Reservation"
      WHERE "providerReservationId" IS NOT NULL AND BTRIM("providerReservationId") <> ''
      GROUP BY provider, "providerReservationId" HAVING COUNT(*) > 1
      ORDER BY provider, "providerReservationId" LIMIT ${SAMPLE_LIMIT}
    `),
    sameRoomAndStay: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, "roomId", "startDate", "endDate", COUNT(*)::int AS "rowCount",
        ARRAY_AGG(id ORDER BY id) AS "reservationIds",
        ARRAY_AGG(DISTINCT provider::text) AS providers,
        ARRAY_AGG(DISTINCT "calendarSourceId") AS "calendarSourceIds",
        COUNT(DISTINCT "rawUid")::int AS "rawUidCount",
        COUNT(DISTINCT "providerReservationId")::int AS "providerReservationIdCount",
        COUNT(DISTINCT NULLIF(LOWER(BTRIM("guestName")), ''))::int AS "guestNameCount"
      FROM "Reservation"
      WHERE status IN (${ACTIVE_RESERVATION_STATUSES})
      GROUP BY "roomId", "startDate", "endDate" HAVING COUNT(*) > 1
      ORDER BY "startDate", "roomId" LIMIT ${SAMPLE_LIMIT}
    `),
    sameGuestAndStay: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, "roomId", "startDate", "endDate", COUNT(*)::int AS "rowCount",
        ARRAY_AGG(id ORDER BY id) AS "reservationIds",
        ARRAY_AGG(DISTINCT "calendarSourceId") AS "calendarSourceIds"
      FROM "Reservation"
      WHERE status IN (${ACTIVE_RESERVATION_STATUSES})
        AND "guestName" IS NOT NULL AND BTRIM("guestName") <> ''
      GROUP BY "roomId", "startDate", "endDate", LOWER(BTRIM("guestName")) HAVING COUNT(*) > 1
      ORDER BY "startDate", "roomId" LIMIT ${SAMPLE_LIMIT}
    `),
    crossSourceSameStay: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, "roomId", "startDate", "endDate", COUNT(*)::int AS "rowCount",
        ARRAY_AGG(id ORDER BY id) AS "reservationIds",
        ARRAY_AGG(DISTINCT "calendarSourceId") AS "calendarSourceIds",
        ARRAY_AGG(DISTINCT provider::text) AS providers
      FROM "Reservation"
      WHERE status IN (${ACTIVE_RESERVATION_STATUSES})
      GROUP BY "roomId", "startDate", "endDate"
      HAVING COUNT(DISTINCT "calendarSourceId") > 1
      ORDER BY "startDate", "roomId" LIMIT ${SAMPLE_LIMIT}
    `),
    inactiveOwnership: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, reservation.id, reservation."calendarSourceId", reservation."roomId",
        reservation.provider::text, reservation.status::text, source."isActive" AS "sourceActive",
        room."isActive" AS "roomActive", property."isActive" AS "propertyActive", company."isActive" AS "companyActive"
      FROM "Reservation" reservation
      JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
      JOIN "Room" room ON room.id = reservation."roomId"
      JOIN "Property" property ON property.id = reservation."propertyId"
      JOIN "Company" company ON company.id = property."companyId"
      WHERE source."isActive" = false OR room."isActive" = false OR property."isActive" = false OR company."isActive" = false
      ORDER BY reservation.id LIMIT ${SAMPLE_LIMIT}
    `),
    sourceScopeMismatch: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, reservation.id, reservation."calendarSourceId", reservation."roomId",
        reservation."propertyId", reservation.provider::text, source."roomId" AS "sourceRoomId",
        source.provider::text AS "sourceProvider", source_room."propertyId" AS "sourcePropertyId"
      FROM "Reservation" reservation
      JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
      JOIN "Room" source_room ON source_room.id = source."roomId"
      WHERE reservation."roomId" <> source."roomId"
        OR reservation."propertyId" <> source_room."propertyId"
        OR reservation.provider <> source.provider
      ORDER BY reservation.id LIMIT ${SAMPLE_LIMIT}
    `),
    unsupportedProvider: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, provider::text, "calendarSourceId", "roomId", status::text
      FROM "Reservation" WHERE provider NOT IN (${SUPPORTED_PROVIDERS})
      ORDER BY id LIMIT ${SAMPLE_LIMIT}
    `),
  };

  const cleaning = {
    operationalOrphans: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, status::text, "roomId", "propertyId", "companyId", "scheduledDate"
      FROM "CleaningTask"
      WHERE "reservationId" IS NULL AND status IN ('PENDING', 'IN_PROGRESS')
      ORDER BY id LIMIT ${SAMPLE_LIMIT}
    `),
    disposableOrphans: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, task.id, task.status::text, task."roomId", task."scheduledDate"
      FROM "CleaningTask" task
      WHERE task."reservationId" IS NULL AND task.status = 'PENDING'
        AND task."assignedAt" IS NULL AND task."startedAt" IS NULL AND task."completedAt" IS NULL
        AND NULLIF(BTRIM(task.note), '') IS NULL
        AND NOT EXISTS (SELECT 1 FROM "CleaningTaskLog" log WHERE log."taskId" = task.id)
        AND NOT EXISTS (SELECT 1 FROM "CleaningPhoto" photo WHERE photo."taskId" = task.id)
      ORDER BY task.id LIMIT ${SAMPLE_LIMIT}
    `),
    orphanTasksRequiringCancellation: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, task.id, task.status::text, task."roomId", task."scheduledDate",
        task."assignedAt", task."startedAt"
      FROM "CleaningTask" task
      WHERE task."reservationId" IS NULL AND task.status IN ('PENDING', 'IN_PROGRESS')
        AND NOT (
          task.status = 'PENDING'
          AND task."assignedAt" IS NULL AND task."startedAt" IS NULL AND task."completedAt" IS NULL
          AND NULLIF(BTRIM(task.note), '') IS NULL
          AND NOT EXISTS (SELECT 1 FROM "CleaningTaskLog" log WHERE log."taskId" = task.id)
          AND NOT EXISTS (SELECT 1 FROM "CleaningPhoto" photo WHERE photo."taskId" = task.id)
        )
      ORDER BY task.id LIMIT ${SAMPLE_LIMIT}
    `),
    retainedDetachedHistory: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, status::text, "roomId", "scheduledDate", "completedAt"
      FROM "CleaningTask"
      WHERE "reservationId" IS NULL AND status IN ('COMPLETED', 'CANCELLED')
      ORDER BY id LIMIT ${SAMPLE_LIMIT}
    `),
    duplicateTasks: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, "reservationId", "roomId", COUNT(*)::int AS "rowCount",
        ARRAY_AGG(id ORDER BY id) AS "cleaningTaskIds"
      FROM "CleaningTask" WHERE "reservationId" IS NOT NULL
      GROUP BY "reservationId", "roomId" HAVING COUNT(*) > 1
      ORDER BY "reservationId" LIMIT ${SAMPLE_LIMIT}
    `),
    missingTasks: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, reservation.id AS "reservationId", reservation."roomId",
        reservation."calendarSourceId", reservation."endDate"
      FROM "Reservation" reservation
      JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
      JOIN "Room" room ON room.id = reservation."roomId"
      JOIN "Property" property ON property.id = reservation."propertyId"
      JOIN "Company" company ON company.id = property."companyId"
      WHERE ${operationalReservationSql}
        AND NOT EXISTS (
          SELECT 1 FROM "CleaningTask" task
          WHERE task."reservationId" = reservation.id AND task."roomId" = reservation."roomId"
        )
      ORDER BY reservation.id LIMIT ${SAMPLE_LIMIT}
    `),
    dateMismatch: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, task.id, task."reservationId", task.status::text,
        task."scheduledDate", reservation."endDate" AS "reservationEndDate"
      FROM "CleaningTask" task
      JOIN "Reservation" reservation ON reservation.id = task."reservationId"
      WHERE task.status IN ('PENDING', 'IN_PROGRESS') AND task."scheduledDate" <> reservation."endDate"
      ORDER BY task.id LIMIT ${SAMPLE_LIMIT}
    `),
    scopeMismatch: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, task.id, task."reservationId", task."companyId", task."propertyId",
        task."roomId", reservation."propertyId" AS "reservationPropertyId", reservation."roomId" AS "reservationRoomId",
        property."companyId" AS "reservationCompanyId"
      FROM "CleaningTask" task
      JOIN "Reservation" reservation ON reservation.id = task."reservationId"
      JOIN "Property" property ON property.id = reservation."propertyId"
      WHERE task."roomId" <> reservation."roomId"
        OR task."propertyId" <> reservation."propertyId"
        OR task."companyId" <> property."companyId"
      ORDER BY task.id LIMIT ${SAMPLE_LIMIT}
    `),
    activeTaskWithInvalidReservation: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, task.id, task."reservationId", task.status::text,
        reservation.status::text AS "reservationStatus", reservation.provider::text,
        source."isActive" AS "sourceActive", room."isActive" AS "roomActive", property."isActive" AS "propertyActive"
      FROM "CleaningTask" task
      JOIN "Reservation" reservation ON reservation.id = task."reservationId"
      JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
      JOIN "Room" room ON room.id = reservation."roomId"
      JOIN "Property" property ON property.id = reservation."propertyId"
      JOIN "Company" company ON company.id = property."companyId"
      WHERE task.status IN ('PENDING', 'IN_PROGRESS') AND NOT (${operationalReservationSql})
      ORDER BY task.id LIMIT ${SAMPLE_LIMIT}
    `),
  };

  const conflictJoin = `
    FROM "ReservationConflict" conflict
    JOIN "Reservation" reservation_a ON reservation_a.id = conflict."reservationAId"
    JOIN "Reservation" reservation_b ON reservation_b.id = conflict."reservationBId"
    JOIN "CalendarSource" source_a ON source_a.id = reservation_a."calendarSourceId"
    JOIN "CalendarSource" source_b ON source_b.id = reservation_b."calendarSourceId"
    JOIN "Room" room ON room.id = conflict."roomId"
    JOIN "Property" property ON property.id = room."propertyId"
    JOIN "Company" company ON company.id = property."companyId"
  `;
  const conflicts = {
    invalidActive: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, conflict.id, conflict."reservationAId", conflict."reservationBId",
        conflict."roomId", conflict."overlapStart", conflict."overlapEnd"
      ${conflictJoin}
      WHERE ${invalidActiveConflictSql}
      ORDER BY conflict.id LIMIT ${SAMPLE_LIMIT}
    `),
    reversedDuplicates: await finding(client, `
      SELECT COUNT(*) OVER() AS __total,
        LEAST("reservationAId", "reservationBId") AS "reservationLowId",
        GREATEST("reservationAId", "reservationBId") AS "reservationHighId",
        COUNT(*)::int AS "rowCount", ARRAY_AGG(id ORDER BY id) AS "conflictIds"
      FROM "ReservationConflict"
      GROUP BY LEAST("reservationAId", "reservationBId"), GREATEST("reservationAId", "reservationBId")
      HAVING COUNT(*) > 1
      ORDER BY "reservationLowId" LIMIT ${SAMPLE_LIMIT}
    `),
    canonicalOrderViolations: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, "roomId", "reservationAId", "reservationBId"
      FROM "ReservationConflict"
      WHERE "reservationAId" >= "reservationBId"
      ORDER BY id LIMIT ${SAMPLE_LIMIT}
    `),
    pastActive: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, "roomId", "reservationAId", "reservationBId", "overlapEnd"
      FROM "ReservationConflict"
      WHERE status = 'ACTIVE' AND "overlapEnd" < $1
      ORDER BY "overlapEnd", id LIMIT ${SAMPLE_LIMIT}
    `, [todayStart]),
  };

  const sync = {
    staleRunning: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, "calendarSourceId", "startedAt"
      FROM "SyncLog"
      WHERE status = 'RUNNING' AND "startedAt" < NOW() - INTERVAL '30 minutes'
      ORDER BY "startedAt", id LIMIT ${SAMPLE_LIMIT}
    `),
    malformedSuccess: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, "calendarSourceId", "completedAt", "fetchedCount",
        "parsedEventCount", "reservationEventCount", "createdCount", "updatedCount", "cancelledCount"
      FROM "SyncLog"
      WHERE status = 'SUCCESS' AND (
        "completedAt" IS NULL OR "fetchedCount" < 0 OR "parsedEventCount" < 0
        OR "reservationEventCount" < 0 OR "createdCount" < 0 OR "updatedCount" < 0 OR "cancelledCount" < 0
      )
      ORDER BY id LIMIT ${SAMPLE_LIMIT}
    `),
    lastSyncedMismatch: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, source.id AS "calendarSourceId", source."lastSyncedAt",
        MAX(log."completedAt") AS "latestSuccessfulAt"
      FROM "CalendarSource" source
      JOIN "SyncLog" log ON log."calendarSourceId" = source.id AND log.status = 'SUCCESS'
      GROUP BY source.id, source."lastSyncedAt"
      HAVING source."lastSyncedAt" IS DISTINCT FROM MAX(log."completedAt")
      ORDER BY source.id LIMIT ${SAMPLE_LIMIT}
    `),
    unsupportedActiveSources: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, id, provider::text, "roomId", "isActive"
      FROM "CalendarSource"
      WHERE "isActive" = true AND provider NOT IN (${SUPPORTED_PROVIDERS})
      ORDER BY id LIMIT ${SAMPLE_LIMIT}
    `),
    activeSourcesOutsideOperationalScope: await finding(client, `
      SELECT COUNT(*) OVER() AS __total, source.id, source.provider::text, source."roomId",
        room."isActive" AS "roomActive", property."isActive" AS "propertyActive", company."isActive" AS "companyActive"
      FROM "CalendarSource" source
      JOIN "Room" room ON room.id = source."roomId"
      JOIN "Property" property ON property.id = room."propertyId"
      JOIN "Company" company ON company.id = property."companyId"
      WHERE source."isActive" = true AND (room."isActive" = false OR property."isActive" = false OR company."isActive" = false)
      ORDER BY source.id LIMIT ${SAMPLE_LIMIT}
    `),
  };

  const checkoutBase = `
    FROM "Reservation" reservation
    JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
    JOIN "Room" room ON room.id = reservation."roomId"
    JOIN "Property" property ON property.id = reservation."propertyId"
    JOIN "Company" company ON company.id = property."companyId"
    WHERE ${operationalReservationSql}
  `;
  const todayCheckIns = await scalar(client, `SELECT COUNT(*)::text AS count ${checkoutBase} AND reservation."startDate" >= $1 AND reservation."startDate" < $2`, [todayStart, todayEnd]);
  const todayCheckOuts = await scalar(client, `SELECT COUNT(*)::text AS count ${checkoutBase} AND reservation."endDate" > $1 AND reservation."endDate" <= $2`, [todayStart, todayEnd]);
  const checkInBase = checkoutBase
    .replace('FROM "Reservation" reservation', 'FROM "Reservation" checkin')
    .replaceAll("reservation.", "checkin.")
    .replace("WHERE", 'WHERE checkin."roomId" = task."roomId" AND');
  const cleaningCounts = (await client.query<{
    priority: string; flexible: string; active: string; completed: string; total: string;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE task.status IN ('PENDING', 'IN_PROGRESS') AND EXISTS (
        SELECT 1 ${checkInBase}
          AND checkin."startDate" >= $1 AND checkin."startDate" < $2
      ))::text AS priority,
      COUNT(*) FILTER (WHERE task.status IN ('PENDING', 'IN_PROGRESS') AND NOT EXISTS (
        SELECT 1 ${checkInBase}
          AND checkin."startDate" >= $1 AND checkin."startDate" < $2
      ))::text AS flexible,
      COUNT(*) FILTER (WHERE task.status IN ('PENDING', 'IN_PROGRESS'))::text AS active,
      COUNT(*) FILTER (WHERE task.status = 'COMPLETED')::text AS completed,
      COUNT(*)::text AS total
    FROM "CleaningTask" task
    JOIN "Reservation" reservation ON reservation.id = task."reservationId"
    JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
    JOIN "Room" room ON room.id = reservation."roomId"
    JOIN "Property" property ON property.id = reservation."propertyId"
    JOIN "Company" company ON company.id = property."companyId"
    WHERE ${operationalReservationSql}
      AND task.status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')
      AND task."roomId" = reservation."roomId"
      AND task."propertyId" = reservation."propertyId"
      AND task."companyId" = company.id
      AND task."scheduledDate" = reservation."endDate"
      AND reservation."endDate" > $1 AND reservation."endDate" <= $2
  `, [todayStart, todayEnd])).rows[0] ?? { priority: "0", flexible: "0", active: "0", completed: "0", total: "0" };

  const validConflictCountSql = `
    SELECT COUNT(*)::text AS count ${conflictJoin}
    WHERE conflict.status = 'ACTIVE'
      AND NOT (${invalidActiveConflictSql.replace("conflict.status = 'ACTIVE' AND ", "")})
      AND conflict."overlapStart" < $2 AND conflict."overlapEnd" > $1
      AND conflict."overlapEnd" >= $3
  `;
  const dashboardOverbookings = await scalar(client, validConflictCountSql, [conflictFrom, conflictToExclusive, todayStart]);
  const detailOverbookings = await scalar(client, validConflictCountSql, [conflictFrom, conflictToExclusive, todayStart]);
  const dashboard: DashboardCounts = {
    todayCheckIns,
    todayCheckOuts,
    priorityCleaning: numberValue(cleaningCounts.priority),
    flexibleCleaning: numberValue(cleaningCounts.flexible),
    activeCleaning: numberValue(cleaningCounts.active),
    completedCleaning: numberValue(cleaningCounts.completed),
    totalCleaning: numberValue(cleaningCounts.total),
    dashboardOverbookings,
    detailOverbookings,
  };

  const invariants = {
    cleaningActiveEqualsPriorityPlusFlexible: dashboard.activeCleaning === dashboard.priorityCleaning + dashboard.flexibleCleaning,
    cleaningTotalEqualsActivePlusCompleted: dashboard.totalCleaning === dashboard.activeCleaning + dashboard.completedCleaning,
    checkoutEqualsCleaningTotal: dashboard.todayCheckOuts === dashboard.totalCleaning,
    dashboardOverbookingEqualsDetail: dashboard.dashboardOverbookings === dashboard.detailOverbookings,
  };

  const errorCount = reservation.invalidDates.count
    + reservation.duplicateSourceUid.count
    + reservation.sourceScopeMismatch.count
    + cleaning.operationalOrphans.count
    + cleaning.duplicateTasks.count
    + cleaning.missingTasks.count
    + cleaning.dateMismatch.count
    + cleaning.scopeMismatch.count
    + cleaning.activeTaskWithInvalidReservation.count
    + conflicts.invalidActive.count
    + conflicts.reversedDuplicates.count
    + conflicts.canonicalOrderViolations.count
    + sync.malformedSuccess.count
    + Object.values(invariants).filter((value) => !value).length;
  const warningCount = reservation.duplicateProviderReservationId.count
    + reservation.sameRoomAndStay.count
    + reservation.sameGuestAndStay.count
    + reservation.crossSourceSameStay.count
    + reservation.inactiveOwnership.count
    + reservation.unsupportedProvider.count
    + cleaning.retainedDetachedHistory.count
    + conflicts.pastActive.count
    + sync.staleRunning.count
    + sync.lastSyncedMismatch.count
    + sync.unsupportedActiveSources.count
    + sync.activeSourcesOutsideOperationalScope.count;

  return {
    reservation,
    cleaning,
    conflicts,
    sync,
    dashboard,
    invariants,
    safeRepairPlan: {
      deleteDisposableOrphanCleaningTasks: cleaning.disposableOrphans.count,
      cancelHistoricalOrInProgressOrphanCleaningTasks: cleaning.orphanTasksRequiringCancellation.count,
      realignCleaningTasks: cleaning.dateMismatch.count,
      createMissingCleaningTasks: cleaning.missingTasks.count,
      resolveInvalidActiveConflicts: conflicts.invalidActive.count,
      ambiguousReservationsRemainReportOnly: reservation.sameRoomAndStay.count,
    },
    summary: { ERROR: errorCount, WARN: warningCount, OK: errorCount === 0 },
  };
}

async function applySafeRepairs(client: Client): Promise<RepairResult> {
  const deletedOrphans = await client.query(`
    DELETE FROM "CleaningTask" task
    WHERE task."reservationId" IS NULL AND task.status = 'PENDING'
      AND task."assignedAt" IS NULL AND task."startedAt" IS NULL AND task."completedAt" IS NULL
      AND NULLIF(BTRIM(task.note), '') IS NULL
      AND NOT EXISTS (SELECT 1 FROM "CleaningTaskLog" log WHERE log."taskId" = task.id)
      AND NOT EXISTS (SELECT 1 FROM "CleaningPhoto" photo WHERE photo."taskId" = task.id)
  `);
  const cancelledOrphans = await client.query(`
    UPDATE "CleaningTask" task SET status = 'CANCELLED', "updatedAt" = NOW()
    WHERE task."reservationId" IS NULL AND task.status IN ('PENDING', 'IN_PROGRESS')
  `);
  const realigned = await client.query(`
    UPDATE "CleaningTask" task SET "scheduledDate" = reservation."endDate", "updatedAt" = NOW()
    FROM "Reservation" reservation
    WHERE reservation.id = task."reservationId"
      AND task.status IN ('PENDING', 'IN_PROGRESS')
      AND task."scheduledDate" <> reservation."endDate"
  `);
  const created = await client.query(`
    INSERT INTO "CleaningTask" (id, "companyId", "propertyId", "roomId", "reservationId", "scheduledDate", status, "createdAt", "updatedAt")
    SELECT CONCAT('audit_', MD5(reservation.id || CLOCK_TIMESTAMP()::text)), company.id, reservation."propertyId",
      reservation."roomId", reservation.id, reservation."endDate", 'PENDING', NOW(), NOW()
    FROM "Reservation" reservation
    JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
    JOIN "Room" room ON room.id = reservation."roomId"
    JOIN "Property" property ON property.id = reservation."propertyId"
    JOIN "Company" company ON company.id = property."companyId"
    WHERE ${operationalReservationSql}
      AND NOT EXISTS (
        SELECT 1 FROM "CleaningTask" task
        WHERE task."reservationId" = reservation.id AND task."roomId" = reservation."roomId"
      )
    ON CONFLICT ("reservationId", "roomId") DO NOTHING
  `);
  const resolved = await client.query(`
    UPDATE "ReservationConflict" conflict SET status = 'RESOLVED', "resolvedAt" = NOW(), "updatedAt" = NOW()
    FROM "Reservation" reservation_a, "Reservation" reservation_b, "CalendarSource" source_a,
      "CalendarSource" source_b, "Room" room, "Property" property, "Company" company
    WHERE reservation_a.id = conflict."reservationAId"
      AND reservation_b.id = conflict."reservationBId"
      AND source_a.id = reservation_a."calendarSourceId"
      AND source_b.id = reservation_b."calendarSourceId"
      AND room.id = conflict."roomId" AND property.id = room."propertyId" AND company.id = property."companyId"
      AND ${invalidActiveConflictSql}
  `);
  return {
    deletedOrphanCleaningTasks: deletedOrphans.rowCount ?? 0,
    cancelledOrphanCleaningTasks: cancelledOrphans.rowCount ?? 0,
    realignedCleaningTasks: realigned.rowCount ?? 0,
    createdMissingCleaningTasks: created.rowCount ?? 0,
    resolvedInvalidConflicts: resolved.rowCount ?? 0,
  };
}

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ ${repair ? "READ WRITE" : "READ ONLY"}`);
    if (repair) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["stayboard-data-consistency-audit"]);
    const before = await collectAudit(client);
    const plannedOrphanRepairs = before.safeRepairPlan.deleteDisposableOrphanCleaningTasks
      + before.safeRepairPlan.cancelHistoricalOrInProgressOrphanCleaningTasks;
    if (repair && plannedOrphanRepairs > MASS_ORPHAN_REPAIR_THRESHOLD && confirmedOrphanCount !== plannedOrphanRepairs) {
      throw new Error(
        `활성 orphan CleaningTask ${plannedOrphanRepairs}건은 대량 변경 보호 기준(${MASS_ORPHAN_REPAIR_THRESHOLD}건)을 초과합니다. `
        + `감사 결과를 검토한 뒤 --confirm-orphan-count=${plannedOrphanRepairs}를 함께 지정하세요.`,
      );
    }
    const repairResult = repair ? await applySafeRepairs(client) : null;
    const after = repair ? await collectAudit(client) : null;
    if (repair) await client.query("COMMIT");
    else await client.query("ROLLBACK");
    console.log(JSON.stringify({
      mode: repair ? "REPAIR" : "READ_ONLY",
      date: dateInput,
      timeZone: "Asia/Tokyo",
      range: { todayStart: todayStart.toISOString(), todayEnd: todayEnd.toISOString() },
      before,
      repair: repairResult,
      after,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "데이터 정합성 감사에 실패했습니다.");
  process.exitCode = 1;
});
