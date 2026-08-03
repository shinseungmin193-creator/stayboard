import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLEANING_LIST_STATUSES,
  CLEANING_SECTIONS,
  getCleaningPriorityMeta,
  getCleaningSectionTone,
  getCleaningStatusMeta,
  isCleaningSection,
} from "../domain/cleaning-meta";

test("cleaning status labels distinguish unassigned and waiting pending tasks", () => {
  assert.equal(getCleaningStatusMeta("PENDING", false).displayStatus, "unassigned");
  assert.equal(getCleaningStatusMeta("PENDING", true).displayStatus, "waiting");
  assert.equal(getCleaningStatusMeta("IN_PROGRESS", true).displayStatus, "inProgress");
  assert.equal(getCleaningStatusMeta("COMPLETED", true).labelKey, "status.completed");
});

test("cleaning section and priority metadata share the same tones", () => {
  assert.equal(getCleaningPriorityMeta("urgent"), getCleaningSectionTone("urgent"));
  assert.equal(getCleaningPriorityMeta("flexible"), getCleaningSectionTone("flexible"));
});

test("completed tasks stay in the two priority sections", () => {
  assert.deepEqual(CLEANING_SECTIONS, ["urgent", "flexible"]);
  assert.deepEqual(CLEANING_LIST_STATUSES, ["PENDING", "IN_PROGRESS", "COMPLETED"]);
  assert.equal(isCleaningSection("completed"), false);
});

test("the cleaning repository preserves section and card order after completion", () => {
  const repository = readFileSync("src/features/cleaning/server/cleaning.repository.ts", "utf8");
  assert.match(repository, /status: \{ in: \[\.\.\.CLEANING_LIST_STATUSES\] \}/);
  assert.match(repository, /orderBy: \[\{ scheduledDate: "asc" \}, \{ id: "asc" \}\]/);
  assert.doesNotMatch(repository, /sectionWhere\("completed"\)|section === "completed"|completedAt: "desc"/);
});

test("completed section messages are removed while summary and status labels remain", () => {
  for (const locale of ["ko", "ja"]) {
    const messages = JSON.parse(readFileSync(`src/messages/${locale}.json`, "utf8"));
    assert.equal(messages.cleaning.sections.completed, undefined);
    assert.equal(messages.cleaning.sections.empty.completed, undefined);
    assert.equal(typeof messages.cleaning.summary.completed, "string");
    assert.equal(typeof messages.cleaning.status.completed, "string");
  }
});
