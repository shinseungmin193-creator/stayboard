import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isActiveCleaningReservationStatus, shouldCancelCleaningTask } from "../domain/cleaning-task-sync-policy";

test("only active checkout reservations create or refresh cleaning tasks", () => {
  assert.equal(isActiveCleaningReservationStatus("CONFIRMED"), true);
  assert.equal(isActiveCleaningReservationStatus("TENTATIVE"), true);
  assert.equal(isActiveCleaningReservationStatus("CANCELLED"), false);
  assert.equal(isActiveCleaningReservationStatus("BLOCKED"), false);
  assert.equal(isActiveCleaningReservationStatus("UNKNOWN"), false);
});

test("예약별 청소 작업은 unique key로 멱등 생성하고 예약 제거 후 운영 상태로 남지 않는다", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const sync = readFileSync("src/features/cleaning/server/cleaning-task-sync.service.ts", "utf8");
  const removal = readFileSync("src/features/calendar-sync/infrastructure/calendar-source-reservation-removal.ts", "utf8");
  assert.match(schema, /@@unique\(\[reservationId, roomId\]\)/);
  assert.match(sync, /createMany\([\s\S]*skipDuplicates: true/);
  assert.match(removal, /cleaningTask\.deleteMany/);
  assert.match(removal, /status: "CANCELLED", reservationId: null/);
  assert.doesNotMatch(removal, /reservationId: null[\s\S]{0,120}status: "PENDING"/);
});

test("reservation cancellation only cancels unfinished cleaning tasks", () => {
  assert.equal(shouldCancelCleaningTask("CANCELLED", "PENDING"), true);
  assert.equal(shouldCancelCleaningTask("CANCELLED", "IN_PROGRESS"), true);
  assert.equal(shouldCancelCleaningTask("CANCELLED", "COMPLETED"), false);
  assert.equal(shouldCancelCleaningTask("CONFIRMED", "PENDING"), false);
});
