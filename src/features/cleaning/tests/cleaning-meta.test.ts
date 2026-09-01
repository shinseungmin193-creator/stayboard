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

test("completed tasks are separated from the two operational priority sections", () => {
  assert.deepEqual(CLEANING_SECTIONS, ["urgent", "flexible"]);
  assert.deepEqual(CLEANING_LIST_STATUSES, ["PENDING", "IN_PROGRESS"]);
  assert.equal(isCleaningSection("completed"), false);
});

test("the cleaning repository keeps the operational queue separate from completed history", () => {
  const repository = readFileSync("src/features/cleaning/server/cleaning.repository.ts", "utf8");
  assert.match(repository, /status: \{ in: \[\.\.\.CLEANING_LIST_STATUSES\] \}/);
  assert.match(repository, /orderBy: \[\{ scheduledDate: "asc" \}, \{ id: "asc" \}\]/);
  assert.match(repository, /buildCompletedCleaningHistoryWhere/);
  assert.match(repository, /orderBy: \[\{ completedAt: "desc" \}, \{ scheduledDate: "desc" \}, \{ id: "desc" \}\]/);
});

test("completed history messages remain available outside priority sections", () => {
  for (const locale of ["ko", "ja"]) {
    const messages = JSON.parse(readFileSync(`src/messages/${locale}.json`, "utf8"));
    assert.equal(messages.cleaning.sections.completed, undefined);
    assert.equal(messages.cleaning.sections.empty.completed, undefined);
    assert.equal(typeof messages.cleaning.tabs.history, "string");
    assert.equal(typeof messages.cleaning.history.title, "string");
    assert.equal(typeof messages.cleaning.summary.completed, "string");
    assert.equal(typeof messages.cleaning.status.completed, "string");
  }
});
