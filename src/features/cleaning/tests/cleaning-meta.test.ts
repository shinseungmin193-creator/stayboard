import assert from "node:assert/strict";
import test from "node:test";

import { getCleaningPriorityMeta, getCleaningSectionTone, getCleaningStatusMeta } from "../domain/cleaning-meta";

test("cleaning status labels distinguish unassigned and waiting pending tasks", () => {
  assert.equal(getCleaningStatusMeta("PENDING", false).displayStatus, "unassigned");
  assert.equal(getCleaningStatusMeta("PENDING", true).displayStatus, "waiting");
  assert.equal(getCleaningStatusMeta("IN_PROGRESS", true).displayStatus, "inProgress");
  assert.equal(getCleaningStatusMeta("COMPLETED", true).labelKey, "status.completed");
});

test("cleaning section and priority metadata share the same tones", () => {
  assert.equal(getCleaningPriorityMeta("urgent"), getCleaningSectionTone("urgent"));
  assert.equal(getCleaningPriorityMeta("flexible"), getCleaningSectionTone("flexible"));
  assert.match(getCleaningSectionTone("completed").accent, /green/);
});
