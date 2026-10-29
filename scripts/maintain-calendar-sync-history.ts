import pg from "pg";

import {
  SYNC_LOG_DETAIL_RETENTION_DAYS,
  SYNC_LOG_FAILURE_RETENTION_DAYS,
  SYNC_LOG_SUCCESS_RETENTION_DAYS,
} from "../src/features/calendar-sync/domain/sync-log-retention";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

const apply = process.argv.includes("--apply");
const batchSize = positiveInteger(process.env.SYNC_HISTORY_MAINTENANCE_BATCH_SIZE, 1_000, 5_000);
const maxBatches = positiveInteger(process.env.SYNC_HISTORY_MAINTENANCE_MAX_BATCHES, 10, 200);
const dayMs = 24 * 60 * 60 * 1_000;
const now = Date.now();
const detailCutoff = new Date(now - positiveInteger(process.env.SYNC_LOG_DETAIL_RETENTION_DAYS, SYNC_LOG_DETAIL_RETENTION_DAYS, 365) * dayMs);
const successCutoff = new Date(now - positiveInteger(process.env.SYNC_LOG_SUCCESS_RETENTION_DAYS, SYNC_LOG_SUCCESS_RETENTION_DAYS, 3650) * dayMs);
const failureCutoff = new Date(now - positiveInteger(process.env.SYNC_LOG_FAILURE_RETENTION_DAYS, SYNC_LOG_FAILURE_RETENTION_DAYS, 3650) * dayMs);

const pool = new pg.Pool({
  connectionString,
  max: 1,
  application_name: "stayboard-sync-history-maintenance",
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
});

async function runBatches(operation: () => Promise<number>) {
  let total = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const affected = await operation();
    total += affected;
    if (affected < batchSize) break;
  }
  return total;
}

async function compactSuccessfulDiagnostics() {
  const result = await pool.query(
    `WITH candidates AS (
       SELECT log.id
         FROM "SyncLog" log
        WHERE log.status = 'SUCCESS'
          AND log."completedAt" < $1
          AND log.quarantined = FALSE
          AND log."unknownEventCount" = 0
          AND log."failedEventCount" = 0
          AND (
            log."unknownEventDetails" IS NOT NULL
            OR log."eventDiagnostics" IS NOT NULL
            OR log."feedFingerprint" IS NOT NULL
            OR log."safetyDiagnostics" IS NOT NULL
          )
        ORDER BY log."completedAt" ASC, log.id ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
     )
     UPDATE "SyncLog" log
        SET "unknownEventDetails" = NULL,
            "eventDiagnostics" = NULL,
            "feedFingerprint" = NULL,
            "safetyDiagnostics" = NULL
       FROM candidates
      WHERE log.id = candidates.id`,
    [detailCutoff, batchSize],
  );
  return result.rowCount ?? 0;
}

async function deleteExpiredLogs() {
  const result = await pool.query(
    `WITH candidates AS (
       SELECT log.id
         FROM "SyncLog" log
        WHERE (
          (log.status = 'SUCCESS' AND log."completedAt" < $1)
          OR (log.status IN ('FAILED', 'TIMEOUT') AND log."completedAt" < $2)
        )
          AND NOT EXISTS (
            SELECT 1 FROM "Reservation" reservation
             WHERE reservation."createdBySyncLogId" = log.id
          )
          AND EXISTS (
            SELECT 1 FROM "SyncLog" newer
             WHERE newer."calendarSourceId" = log."calendarSourceId"
               AND (newer."createdAt", newer.id) > (log."createdAt", log.id)
          )
        ORDER BY log."completedAt" ASC, log.id ASC
        LIMIT $3
        FOR UPDATE OF log SKIP LOCKED
     )
     DELETE FROM "SyncLog" log
      USING candidates
      WHERE log.id = candidates.id`,
    [successCutoff, failureCutoff, batchSize],
  );
  return result.rowCount ?? 0;
}

async function deleteOrphanedRuns() {
  const result = await pool.query(
    `WITH candidates AS (
       SELECT run.id
         FROM "SyncRun" run
        WHERE run."finishedAt" < $1
          AND NOT EXISTS (
            SELECT 1 FROM "SyncLog" log WHERE log."syncRunId" = run.id
          )
        ORDER BY run."finishedAt" ASC, run.id ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
     )
     DELETE FROM "SyncRun" run
      USING candidates
      WHERE run.id = candidates.id`,
    [successCutoff, batchSize],
  );
  return result.rowCount ?? 0;
}

async function main() {
  if (!apply) {
    console.info("[sync-history-maintenance] dry-run; pass --apply to mutate sync history", {
      batchSize,
      maxBatches,
      detailCutoff: detailCutoff.toISOString(),
      successCutoff: successCutoff.toISOString(),
      failureCutoff: failureCutoff.toISOString(),
    });
    return;
  }

  const lock = await pool.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock(20261029, 1) AS acquired",
  );
  if (!lock.rows[0]?.acquired) {
    console.info("[sync-history-maintenance] another worker owns the maintenance lock");
    return;
  }

  try {
    const deletedLogs = await runBatches(deleteExpiredLogs);
    const compacted = await runBatches(compactSuccessfulDiagnostics);
    const deletedRuns = await runBatches(deleteOrphanedRuns);
    console.info("[sync-history-maintenance] complete", { compacted, deletedLogs, deletedRuns });
  } finally {
    await pool.query("SELECT pg_advisory_unlock(20261029, 1)");
  }
}

main()
  .catch((error) => {
    console.error("[sync-history-maintenance] fatal", error instanceof Error ? error.name : "UnknownError");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
