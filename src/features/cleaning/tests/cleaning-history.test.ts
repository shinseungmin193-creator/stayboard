import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildCompletedCleaningHistoryWhere } from "../domain/cleaning-history";
import { isCleaningPhotoRetentionExpired } from "../domain/cleaning-retention";

test("completed history is scoped without a selected-day or live-reservation dependency", () => {
  const where = buildCompletedCleaningHistoryWhere({
    roomWhere: { propertyId: "property-scope" },
    companyId: "company-1",
    propertyId: "property-1",
    roomId: "room-1",
    assigneeId: "user-1",
  });
  const serialized = JSON.stringify(where);
  assert.match(serialized, /"status":"COMPLETED"/);
  assert.match(serialized, /"companyId":"company-1"/);
  assert.match(serialized, /"assignedToId":"user-1"/);
  assert.doesNotMatch(serialized, /scheduledDate|completedAt|reservation/);
});

test("unassigned operational filter does not hide completed history", () => {
  const serialized = JSON.stringify(buildCompletedCleaningHistoryWhere({ assigneeId: "unassigned" }));
  assert.doesNotMatch(serialized, /assignedToId|assigneeName/);
});

test("photo retention expiry starts exactly seven days after completion", () => {
  const completedAt = new Date("2026-08-21T03:00:00.000Z");
  assert.equal(isCleaningPhotoRetentionExpired(completedAt, new Date("2026-08-28T02:59:59.999Z")), false);
  assert.equal(isCleaningPhotoRetentionExpired(completedAt, new Date("2026-08-28T03:00:00.000Z")), true);
  assert.equal(isCleaningPhotoRetentionExpired(null, new Date("2026-09-02T00:00:00.000Z")), false);
});

test("photo cleanup never deletes cleaning tasks or task history rows", () => {
  const cleanup = readFileSync("scripts/cleanup-cleaning-photos.ts", "utf8");
  assert.match(cleanup, /UPDATE "CleaningPhoto"/);
  assert.doesNotMatch(cleanup, /DELETE FROM "CleaningTask"|cleaningTask\.(?:delete|deleteMany)/);
  assert.doesNotMatch(cleanup, /DELETE FROM "CleaningTaskLog"|cleaningTaskLog\.(?:delete|deleteMany)/);
});

test("completed history UI exposes required work fields and retention message", () => {
  const component = readFileSync("src/features/cleaning/components/cleaning-history-list.tsx", "utf8");
  for (const field of ["property", "room", "cleaningDate", "assignee", "startedAt", "completedAt", "status"]) {
    assert.match(component, new RegExp(`fields\\.${field}`));
  }
  assert.match(component, /photos\.retentionExpired/);
  assert.match(component, /activePhotos/);
});
