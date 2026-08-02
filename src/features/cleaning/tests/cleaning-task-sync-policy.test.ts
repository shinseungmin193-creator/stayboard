import assert from "node:assert/strict";
import test from "node:test";

import { isActiveCleaningReservationStatus, shouldCancelCleaningTask } from "../domain/cleaning-task-sync-policy";

test("only active checkout reservations create or refresh cleaning tasks", () => {
  assert.equal(isActiveCleaningReservationStatus("CONFIRMED"), true);
  assert.equal(isActiveCleaningReservationStatus("TENTATIVE"), true);
  assert.equal(isActiveCleaningReservationStatus("CANCELLED"), false);
  assert.equal(isActiveCleaningReservationStatus("BLOCKED"), false);
  assert.equal(isActiveCleaningReservationStatus("UNKNOWN"), false);
});

test("reservation cancellation only cancels unfinished cleaning tasks", () => {
  assert.equal(shouldCancelCleaningTask("CANCELLED", "PENDING"), true);
  assert.equal(shouldCancelCleaningTask("CANCELLED", "IN_PROGRESS"), true);
  assert.equal(shouldCancelCleaningTask("CANCELLED", "COMPLETED"), false);
  assert.equal(shouldCancelCleaningTask("CONFIRMED", "PENDING"), false);
});
