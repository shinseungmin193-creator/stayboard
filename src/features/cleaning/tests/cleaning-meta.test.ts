import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLEANING_DISPLAY_SECTIONS,
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

test("completed tasks have a dedicated display section outside operational priority sections", () => {
  assert.deepEqual(CLEANING_SECTIONS, ["urgent", "flexible"]);
  assert.deepEqual(CLEANING_DISPLAY_SECTIONS, ["urgent", "flexible", "completed"]);
  assert.deepEqual(CLEANING_LIST_STATUSES, ["PENDING", "IN_PROGRESS"]);
  assert.equal(isCleaningSection("completed"), false);
  assert.equal(getCleaningSectionTone("completed").labelKey, "sections.completed");
});

test("the cleaning repository separates selected-date completed tasks from operational sections", () => {
  const repository = readFileSync("src/features/cleaning/server/cleaning.repository.ts", "utf8");
  const taskQuery = readFileSync("src/features/cleaning/server/cleaning-task-query.ts", "utf8");
  const completedPolicy = repository.slice(repository.indexOf("const completedWhere"), repository.indexOf("const historyWhere"));
  assert.match(repository, /buildSelectedDateCleaningTaskWhere\(\{[\s\S]*?statuses: CLEANING_LIST_STATUSES/);
  assert.match(taskQuery, /\{ status: \{ in: \[\.\.\.input\.statuses\] \} \}/);
  assert.match(completedPolicy, /AND: \[summaryBase, \{ status: "COMPLETED" \}\]/);
  assert.doesNotMatch(completedPolicy, /photo|note|memo/i);
  assert.match(repository, /cleaningTask\.findMany\(\{[\s\S]*?where: completedWhere/);
  assert.match(repository, /const completedCount = completedRows\.length/);
  assert.match(repository, /orderBy: \[\{ scheduledDate: "asc" \}, \{ id: "asc" \}\]/);
  assert.match(repository, /where: completedWhere,[\s\S]*?orderBy: \[\{ completedAt: "desc" \}, \{ scheduledDate: "desc" \}, \{ id: "desc" \}\]/);
  assert.match(repository, /buildCompletedCleaningHistoryWhere/);
});

test("selected-date completed cards render in their own read-only section with completion details", () => {
  const repository = readFileSync("src/features/cleaning/server/cleaning.repository.ts", "utf8");
  const workspace = readFileSync("src/features/cleaning/components/cleaning-workspace.tsx", "utf8");
  const card = readFileSync("src/features/cleaning/components/cleaning-task-card.tsx", "utf8");
  const badge = readFileSync("src/features/cleaning/components/cleaning-task-status-badge.tsx", "utf8");
  const details = readFileSync("src/features/cleaning/components/cleaning-task-detail-dialog.tsx", "utf8");
  assert.match(repository, /priorityWhere\(section\)/);
  assert.match(workspace, /section="completed" data=\{data\.completed\}/);
  assert.match(workspace, /\.\.\.data\.completed\.items/);
  assert.match(card, /isCleaningRecordCompleted\(task\)/);
  assert.match(card, /isCompleted[\s\S]*?label: t\("actions\.details"\)/);
  assert.match(card, /task\.status === "IN_PROGRESS"[\s\S]*?label: t\("actions\.complete"\)/);
  assert.match(card, /fields\.completedAt[\s\S]*?fields\.assignee[\s\S]*?fields\.photoCount[\s\S]*?details\.note/);
  assert.match(card, /photos\.count[\s\S]*?task\.photoCount/);
  assert.match(badge, /getCleaningStatusMeta\(task\.status/);
  assert.match(details, /task\.startedAt[\s\S]*?task\.completedAt[\s\S]*?task\.photoCount/);
  assert.match(details, /task\.note \|\| t\("details\.noNote"\)/);
});

test("completed section messages are available on mobile and desktop locales", () => {
  for (const locale of ["ko", "ja"]) {
    const messages = JSON.parse(readFileSync(`src/messages/${locale}.json`, "utf8"));
    assert.equal(typeof messages.cleaning.sections.completed, "string");
    assert.equal(typeof messages.cleaning.sections.empty.completed, "string");
    assert.equal(typeof messages.cleaning.tabs.history, "string");
    assert.equal(typeof messages.cleaning.history.title, "string");
    assert.equal(typeof messages.cleaning.summary.completed, "string");
    assert.equal(typeof messages.cleaning.status.completed, "string");
  }
});
