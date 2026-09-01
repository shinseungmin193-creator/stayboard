import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLEANING_LIST_STATUSES,
  PAST_CLEANING_LIST_STATUSES,
  CLEANING_SECTIONS,
  getCleaningListStatusesForDate,
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

test("today keeps completed tasks outside the two operational priority sections", () => {
  assert.deepEqual(CLEANING_SECTIONS, ["urgent", "flexible"]);
  assert.deepEqual(CLEANING_LIST_STATUSES, ["PENDING", "IN_PROGRESS"]);
  assert.deepEqual(getCleaningListStatusesForDate("2026-09-02", "2026-09-02"), CLEANING_LIST_STATUSES);
  assert.deepEqual(getCleaningListStatusesForDate("2026-09-03", "2026-09-02"), CLEANING_LIST_STATUSES);
  assert.equal(isCleaningSection("completed"), false);
});

test("past dates include completed tasks while excluding cancelled tasks", () => {
  assert.deepEqual(PAST_CLEANING_LIST_STATUSES, ["PENDING", "IN_PROGRESS", "COMPLETED"]);
  const statuses = getCleaningListStatusesForDate("2026-09-01", "2026-09-02");
  const tasks = [
    ...Array.from({ length: 9 }, (_, index) => ({ id: `completed-${index}`, status: "COMPLETED" as const })),
    { id: "pending", status: "PENDING" as const },
    { id: "in-progress", status: "IN_PROGRESS" as const },
    { id: "cancelled", status: "CANCELLED" as const },
  ];

  assert.deepEqual(tasks.filter((task) => task.status !== "CANCELLED" && statuses.includes(task.status)).map((task) => task.id), [
    ...Array.from({ length: 9 }, (_, index) => `completed-${index}`),
    "pending",
    "in-progress",
  ]);
});

test("the cleaning repository applies the selected-date status policy before priority sections", () => {
  const repository = readFileSync("src/features/cleaning/server/cleaning.repository.ts", "utf8");
  const taskQuery = readFileSync("src/features/cleaning/server/cleaning-task-query.ts", "utf8");
  assert.match(repository, /getCleaningListStatusesForDate\(dateInput, getCleaningDateInput\(referenceAt, timeZone\)\)/);
  assert.match(repository, /buildSelectedDateCleaningTaskWhere\(\{[\s\S]*?statuses: listStatuses/);
  assert.match(taskQuery, /\{ status: \{ in: \[\.\.\.input\.statuses\] \} \}/);
  assert.match(taskQuery, /includeCompleted[\s\S]*?status: "COMPLETED"[\s\S]*?scheduledDate: \{ gt: input\.start, lte: input\.end \}/);
  assert.doesNotMatch(taskQuery, /status: "CANCELLED"/);
  assert.match(repository, /orderBy: \[\{ scheduledDate: "asc" \}, \{ id: "asc" \}\]/);
  assert.match(repository, /buildCompletedCleaningHistoryWhere/);
  assert.match(repository, /orderBy: \[\{ completedAt: "desc" \}, \{ scheduledDate: "desc" \}, \{ id: "desc" \}\]/);
});

test("past completed cards stay in priority sections and are read-only", () => {
  const repository = readFileSync("src/features/cleaning/server/cleaning.repository.ts", "utf8");
  const card = readFileSync("src/features/cleaning/components/cleaning-task-card.tsx", "utf8");
  const badge = readFileSync("src/features/cleaning/components/cleaning-task-status-badge.tsx", "utf8");
  const details = readFileSync("src/features/cleaning/components/cleaning-task-detail-dialog.tsx", "utf8");
  assert.match(repository, /priorityWhere\(section\)/);
  assert.match(repository, /task\.status !== "COMPLETED" && !isCleaningTaskAlignedWithReservation\(task\)/);
  assert.match(card, /task\.status === "COMPLETED"[\s\S]*?label: t\("actions\.details"\)/);
  assert.match(card, /task\.status === "IN_PROGRESS"[\s\S]*?label: t\("actions\.complete"\)/);
  assert.match(badge, /getCleaningStatusMeta\(task\.status/);
  assert.match(details, /task\.startedAt[\s\S]*?task\.completedAt[\s\S]*?task\.photoCount/);
  assert.match(details, /task\.note \|\| t\("details\.noNote"\)/);
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
