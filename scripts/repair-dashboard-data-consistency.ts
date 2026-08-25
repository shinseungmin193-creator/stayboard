import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { getZonedDateInput, getZonedMidnight, isValidDateInput, shiftDateInput } from "../src/lib/zoned-date";

interface CleaningCandidate {
  id: string;
  status: "PENDING" | "IN_PROGRESS";
  reservationId: string | null;
  reason: "ORPHAN" | "INVALID_RESERVATION" | "MISALIGNED_DATE";
  scheduledDate: Date;
  reservationEndDate: Date | null;
  hasHistory: boolean;
}

interface ConflictCandidate {
  id: string;
  reason: string;
}

interface CountRow { count: string }
interface CleaningSummaryRow { priority: string; flexible: string }

const argumentsList = process.argv.slice(2);
const apply = argumentsList.includes("--apply");
const dateArgument = argumentsList.find((argument) => argument.startsWith("--date="));
const dateInput = dateArgument?.slice("--date=".length) ?? getZonedDateInput(new Date());
const invalidArguments = argumentsList.filter((argument) => argument !== "--apply" && !argument.startsWith("--date="));
if (invalidArguments.length || !isValidDateInput(dateInput)) {
  throw new Error("지원하지 않는 인자입니다. --apply와 --date=YYYY-MM-DD만 사용할 수 있습니다.");
}
const rangeStart = getZonedMidnight(dateInput);
const rangeEnd = getZonedMidnight(shiftDateInput(dateInput, 1));
const conflictRangeStart = getZonedMidnight(shiftDateInput(dateInput, -30));
const conflictRangeEnd = getZonedMidnight(shiftDateInput(dateInput, 181));

const cleaningCandidatesSql = `
  SELECT task.id, task.status::text AS status, task."reservationId", task."scheduledDate",
    reservation."endDate" AS "reservationEndDate",
    (
      task."assignedAt" IS NOT NULL OR task."startedAt" IS NOT NULL OR task."completedAt" IS NOT NULL
      OR NULLIF(BTRIM(task.note), '') IS NOT NULL
      OR EXISTS (SELECT 1 FROM "CleaningTaskLog" log WHERE log."taskId" = task.id)
      OR EXISTS (SELECT 1 FROM "CleaningPhoto" photo WHERE photo."taskId" = task.id)
    ) AS "hasHistory",
    CASE
      WHEN reservation.id IS NULL THEN 'ORPHAN'
      WHEN reservation.status NOT IN ('CONFIRMED', 'TENTATIVE')
        OR reservation.provider NOT IN ('AIRBNB', 'BOOKING', 'AGODA')
        OR source.id IS NULL OR source."isActive" = false
        OR room.id IS NULL OR room."isActive" = false
        OR property.id IS NULL OR property."isActive" = false
        OR reservation."roomId" <> task."roomId"
        OR reservation."propertyId" <> task."propertyId"
        THEN 'INVALID_RESERVATION'
      WHEN task."scheduledDate" <> reservation."endDate" THEN 'MISALIGNED_DATE'
      ELSE NULL
    END AS reason
  FROM "CleaningTask" task
  LEFT JOIN "Reservation" reservation ON reservation.id = task."reservationId"
  LEFT JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
  JOIN "Room" room ON room.id = task."roomId"
  JOIN "Property" property ON property.id = task."propertyId"
  JOIN "Company" company ON company.id = task."companyId"
  WHERE task.status IN ('PENDING', 'IN_PROGRESS')
    AND task."scheduledDate" > $1 AND task."scheduledDate" <= $2
    AND room."isActive" = true AND property."isActive" = true AND company."isActive" = true
    AND (
      reservation.id IS NULL
      OR reservation.status NOT IN ('CONFIRMED', 'TENTATIVE')
      OR reservation.provider NOT IN ('AIRBNB', 'BOOKING', 'AGODA')
      OR source.id IS NULL OR source."isActive" = false
      OR room.id IS NULL OR room."isActive" = false
      OR property.id IS NULL OR property."isActive" = false
      OR reservation."roomId" <> task."roomId"
      OR reservation."propertyId" <> task."propertyId"
      OR task."scheduledDate" <> reservation."endDate"
    )
  ORDER BY task.id
`;

const invalidConflictsSql = `
  SELECT conflict.id,
    CASE
      WHEN room."isActive" = false OR property."isActive" = false THEN 'INACTIVE_ROOM_OR_PROPERTY'
      WHEN source_a."isActive" = false OR source_b."isActive" = false THEN 'INACTIVE_SOURCE'
      WHEN reservation_a.status NOT IN ('CONFIRMED', 'TENTATIVE')
        OR reservation_b.status NOT IN ('CONFIRMED', 'TENTATIVE') THEN 'INACTIVE_RESERVATION'
      WHEN reservation_a.provider NOT IN ('AIRBNB', 'BOOKING', 'AGODA')
        OR reservation_b.provider NOT IN ('AIRBNB', 'BOOKING', 'AGODA') THEN 'NON_OTA_PROVIDER'
      WHEN reservation_a."roomId" <> conflict."roomId" OR reservation_b."roomId" <> conflict."roomId" THEN 'ROOM_MISMATCH'
      ELSE 'NO_OVERLAP'
    END AS reason
  FROM "ReservationConflict" conflict
  JOIN "Reservation" reservation_a ON reservation_a.id = conflict."reservationAId"
  JOIN "Reservation" reservation_b ON reservation_b.id = conflict."reservationBId"
  JOIN "CalendarSource" source_a ON source_a.id = reservation_a."calendarSourceId"
  JOIN "CalendarSource" source_b ON source_b.id = reservation_b."calendarSourceId"
  JOIN "Room" room ON room.id = conflict."roomId"
  JOIN "Property" property ON property.id = room."propertyId"
  WHERE conflict.status = 'ACTIVE'
    AND (
      room."isActive" = false OR property."isActive" = false
      OR source_a."isActive" = false OR source_b."isActive" = false
      OR reservation_a.status NOT IN ('CONFIRMED', 'TENTATIVE')
      OR reservation_b.status NOT IN ('CONFIRMED', 'TENTATIVE')
      OR reservation_a.provider NOT IN ('AIRBNB', 'BOOKING', 'AGODA')
      OR reservation_b.provider NOT IN ('AIRBNB', 'BOOKING', 'AGODA')
      OR reservation_a."roomId" <> conflict."roomId"
      OR reservation_b."roomId" <> conflict."roomId"
      OR reservation_a."startDate" >= reservation_b."endDate"
      OR reservation_a."endDate" <= reservation_b."startDate"
    )
  ORDER BY conflict.id
`;

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["dashboard-data-consistency-repair"]);
    const cleaningCandidates = (await client.query<CleaningCandidate>(cleaningCandidatesSql, [rangeStart, rangeEnd])).rows;
    const conflictCandidates = (await client.query<ConflictCandidate>(invalidConflictsSql)).rows;
    const checkoutCount = Number((await client.query<CountRow>(`
      SELECT COUNT(*)::text AS count
      FROM "Reservation" reservation
      JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
      JOIN "Room" room ON room.id = reservation."roomId"
      JOIN "Property" property ON property.id = reservation."propertyId"
      JOIN "Company" company ON company.id = property."companyId"
      WHERE reservation.status IN ('CONFIRMED', 'TENTATIVE')
        AND reservation.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
        AND source."isActive" = true AND room."isActive" = true
        AND property."isActive" = true AND company."isActive" = true
        AND reservation."endDate" > $1 AND reservation."endDate" <= $2
    `, [rangeStart, rangeEnd])).rows[0]?.count ?? 0);
    const rawCleaningCount = Number((await client.query<CountRow>(`
      SELECT COUNT(*)::text AS count
      FROM "CleaningTask" task
      JOIN "Room" room ON room.id = task."roomId"
      JOIN "Property" property ON property.id = task."propertyId"
      JOIN "Company" company ON company.id = task."companyId"
      WHERE task.status IN ('PENDING', 'IN_PROGRESS')
        AND room."isActive" = true AND property."isActive" = true AND company."isActive" = true
        AND task."scheduledDate" > $1 AND task."scheduledDate" <= $2
    `, [rangeStart, rangeEnd])).rows[0]?.count ?? 0);
    const cleaningSummary = (await client.query<CleaningSummaryRow>(`
      SELECT
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM "Reservation" checkin
          JOIN "CalendarSource" checkin_source ON checkin_source.id = checkin."calendarSourceId"
          WHERE checkin."roomId" = task."roomId"
            AND checkin.status IN ('CONFIRMED', 'TENTATIVE')
            AND checkin.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
            AND checkin_source."isActive" = true
            AND checkin."startDate" >= $1 AND checkin."startDate" < $2
        ))::text AS priority,
        COUNT(*) FILTER (WHERE NOT EXISTS (
          SELECT 1 FROM "Reservation" checkin
          JOIN "CalendarSource" checkin_source ON checkin_source.id = checkin."calendarSourceId"
          WHERE checkin."roomId" = task."roomId"
            AND checkin.status IN ('CONFIRMED', 'TENTATIVE')
            AND checkin.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
            AND checkin_source."isActive" = true
            AND checkin."startDate" >= $1 AND checkin."startDate" < $2
        ))::text AS flexible
      FROM "CleaningTask" task
      JOIN "Reservation" reservation ON reservation.id = task."reservationId"
      JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
      JOIN "Room" room ON room.id = task."roomId"
      JOIN "Property" property ON property.id = task."propertyId"
      JOIN "Company" company ON company.id = task."companyId"
      WHERE task.status IN ('PENDING', 'IN_PROGRESS')
        AND reservation.status IN ('CONFIRMED', 'TENTATIVE')
        AND reservation.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
        AND source."isActive" = true AND room."isActive" = true
        AND property."isActive" = true AND company."isActive" = true
        AND task."scheduledDate" = reservation."endDate"
        AND reservation."endDate" > $1 AND reservation."endDate" <= $2
    `, [rangeStart, rangeEnd])).rows[0] ?? { priority: "0", flexible: "0" };
    const activeOverbookingCount = Number((await client.query<CountRow>(`
      SELECT COUNT(*)::text AS count
      FROM "ReservationConflict" conflict
      JOIN "Reservation" reservation_a ON reservation_a.id = conflict."reservationAId"
      JOIN "Reservation" reservation_b ON reservation_b.id = conflict."reservationBId"
      JOIN "CalendarSource" source_a ON source_a.id = reservation_a."calendarSourceId"
      JOIN "CalendarSource" source_b ON source_b.id = reservation_b."calendarSourceId"
      JOIN "Room" room ON room.id = conflict."roomId"
      JOIN "Property" property ON property.id = room."propertyId"
      JOIN "Company" company ON company.id = property."companyId"
      WHERE conflict.status = 'ACTIVE'
        AND conflict."overlapStart" < $2 AND conflict."overlapEnd" > $1
        AND conflict."overlapEnd" >= $3
        AND reservation_a.status IN ('CONFIRMED', 'TENTATIVE')
        AND reservation_b.status IN ('CONFIRMED', 'TENTATIVE')
        AND reservation_a.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
        AND reservation_b.provider IN ('AIRBNB', 'BOOKING', 'AGODA')
        AND source_a."isActive" = true AND source_b."isActive" = true
        AND room."isActive" = true AND property."isActive" = true AND company."isActive" = true
    `, [conflictRangeStart, conflictRangeEnd, rangeStart])).rows[0]?.count ?? 0);
    const deleteTaskIds = cleaningCandidates
      .filter((candidate) => candidate.reason !== "MISALIGNED_DATE" && candidate.status === "PENDING" && !candidate.hasHistory)
      .map((candidate) => candidate.id);
    const deleteTaskIdSet = new Set(deleteTaskIds);
    const cancelTaskIds = cleaningCandidates
      .filter((candidate) => candidate.reason !== "MISALIGNED_DATE" && !deleteTaskIdSet.has(candidate.id))
      .map((candidate) => candidate.id);
    const realignCandidates = cleaningCandidates.filter((candidate) => candidate.reason === "MISALIGNED_DATE" && candidate.reservationEndDate);

    console.log(JSON.stringify({
      mode: apply ? "APPLY" : "DRY_RUN",
      date: dateInput,
      before: {
        checkoutReservations: checkoutCount,
        rawOperationalCleaningTasks: rawCleaningCount,
        priorityCleaningTasks: Number(cleaningSummary.priority),
        flexibleCleaningTasks: Number(cleaningSummary.flexible),
        dashboardActiveOverbookings: activeOverbookingCount,
        overbookingPageActiveItems: activeOverbookingCount,
      },
      cleaningCandidates: cleaningCandidates.map((candidate) => ({
        id: candidate.id,
        reservationId: candidate.reservationId,
        scheduledDate: candidate.scheduledDate.toISOString(),
        reason: candidate.reason,
        action: deleteTaskIdSet.has(candidate.id) ? "DELETE" : candidate.reason === "MISALIGNED_DATE" ? "REALIGN" : "CANCEL",
      })),
      invalidConflicts: conflictCandidates,
    }, null, 2));

    if (!apply) {
      await client.query("ROLLBACK");
      console.log("실제 데이터는 변경하지 않았습니다. 검토 후 --apply로 실행하세요.");
      return;
    }

    const deletedTasks = deleteTaskIds.length
      ? await client.query(`DELETE FROM "CleaningTask" WHERE id = ANY($1::text[]) AND status = 'PENDING'`, [deleteTaskIds])
      : { rowCount: 0 };
    const cancelledTasks = cancelTaskIds.length
      ? await client.query(`UPDATE "CleaningTask" SET status = 'CANCELLED', "updatedAt" = NOW() WHERE id = ANY($1::text[]) AND status IN ('PENDING', 'IN_PROGRESS')`, [cancelTaskIds])
      : { rowCount: 0 };
    let realignedTaskCount = 0;
    for (const candidate of realignCandidates) {
      const result = await client.query(`
        UPDATE "CleaningTask" task SET "scheduledDate" = reservation."endDate", "updatedAt" = NOW()
        FROM "Reservation" reservation
        WHERE task.id = $1 AND reservation.id = task."reservationId" AND task."scheduledDate" <> reservation."endDate"
      `, [candidate.id]);
      realignedTaskCount += result.rowCount ?? 0;
    }
    const resolvedConflicts = conflictCandidates.length
      ? await client.query(`
          UPDATE "ReservationConflict"
          SET status = 'RESOLVED', "resolvedAt" = NOW(), "updatedAt" = NOW()
          WHERE id = ANY($1::text[]) AND status = 'ACTIVE'
        `, [conflictCandidates.map((candidate) => candidate.id)])
      : { rowCount: 0 };
    await client.query("COMMIT");
    console.log(JSON.stringify({
      deletedCleaningTasks: deletedTasks.rowCount ?? 0,
      cancelledCleaningTasks: cancelledTasks.rowCount ?? 0,
      realignedCleaningTasks: realignedTaskCount,
      resolvedInvalidConflicts: resolvedConflicts.rowCount ?? 0,
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "데이터 정합성 repair에 실패했습니다.");
  process.exitCode = 1;
});
