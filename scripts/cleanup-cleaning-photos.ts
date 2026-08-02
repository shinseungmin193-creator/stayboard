import pg from "pg";

import { getCleaningPhotoStorage } from "../src/features/cleaning/storage/local-file-storage-provider";
import { CLEANING_PHOTO_DELETE_BATCH_SIZE } from "../src/features/cleaning/domain/cleaning-retention";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const requestedBatchSize = Number(process.env.CLEANING_PHOTO_CLEANUP_BATCH_SIZE ?? CLEANING_PHOTO_DELETE_BATCH_SIZE);
const batchSize = Number.isInteger(requestedBatchSize) && requestedBatchSize > 0
  ? Math.min(requestedBatchSize, 500)
  : CLEANING_PHOTO_DELETE_BATCH_SIZE;

const pool = new pg.Pool({ connectionString });
const storage = getCleaningPhotoStorage();

function safeDeleteError(error: unknown) {
  const value = error as NodeJS.ErrnoException;
  return [value.name || "Error", value.code].filter(Boolean).join(":").slice(0, 200);
}

async function main() {
  const candidates = await pool.query<{ id: string; storageKey: string }>(
    `SELECT "id", "storageKey"
       FROM "CleaningPhoto"
      WHERE "deleteAfter" <= NOW()
        AND "deletedAt" IS NULL
        AND "storageKey" IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "CleaningTask"
           WHERE "CleaningTask"."id" = "CleaningPhoto"."taskId"
             AND "CleaningTask"."status" = 'COMPLETED'
        )
      ORDER BY "deleteAfter" ASC, "id" ASC
      LIMIT $1`,
    [batchSize],
  );

  let deleted = 0;
  let failed = 0;
  for (const photo of candidates.rows) {
    try {
      await storage.delete(photo.storageKey);
      await pool.query(
        `UPDATE "CleaningPhoto"
            SET "storageKey" = NULL,
                "deletedAt" = NOW(),
                "deleteError" = NULL
          WHERE "id" = $1
            AND "storageKey" = $2
            AND "deletedAt" IS NULL`,
        [photo.id, photo.storageKey],
      );
      deleted += 1;
    } catch (error) {
      failed += 1;
      await pool.query(
        `UPDATE "CleaningPhoto"
            SET "deleteAttempts" = "deleteAttempts" + 1,
                "deleteError" = $2
          WHERE "id" = $1
            AND "deletedAt" IS NULL`,
        [photo.id, safeDeleteError(error)],
      );
    }
  }

  console.log(`[cleaning-photo-cleanup] candidates=${candidates.rowCount ?? 0} deleted=${deleted} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[cleaning-photo-cleanup] fatal", safeDeleteError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
