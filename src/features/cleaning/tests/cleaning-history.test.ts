import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildCompletedCleaningHistoryWhere, groupCompletedCleaningHistory } from "../domain/cleaning-history";
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

test("Asia/Tokyo completedAt 기준으로 오늘 9건·어제 13건·3일 전 5건을 그룹화한다", () => {
  const referenceAt = new Date("2026-09-02T06:00:00.000Z");
  const items = [
    ...Array.from({ length: 9 }, (_, index) => ({ id: `today-${index}`, completedAt: `2026-09-02T0${index}:00:00.000Z` })),
    ...Array.from({ length: 13 }, (_, index) => ({ id: `yesterday-${index}`, completedAt: new Date(Date.UTC(2026, 8, 1, 14 - index)).toISOString() })),
    ...Array.from({ length: 5 }, (_, index) => ({ id: `older-${index}`, completedAt: `2026-08-30T0${index}:00:00.000Z` })),
  ];
  const groups = groupCompletedCleaningHistory(items, referenceAt, "Asia/Tokyo");

  assert.deepEqual(groups.map((group) => ({ dateKey: group.dateKey, kind: group.kind, count: group.items.length })), [
    { dateKey: "2026-09-02", kind: "today", count: 9 },
    { dateKey: "2026-09-01", kind: "yesterday", count: 13 },
    { dateKey: "2026-08-30", kind: "date", count: 5 },
  ]);
  assert.equal(groups.reduce((sum, group) => sum + group.items.length, 0), items.length);
  for (const group of groups) {
    assert.deepEqual(group.items, [...group.items].sort((left, right) => new Date(right.completedAt!).getTime() - new Date(left.completedAt!).getTime() || right.id.localeCompare(left.id)));
  }
});

test("날짜가 바뀌어도 어제 완료 기록은 제거되지 않고 상대 라벨만 변경된다", () => {
  const items = [{ id: "completed", completedAt: "2026-09-02T03:00:00.000Z" }];
  const todayGroups = groupCompletedCleaningHistory(items, new Date("2026-09-02T06:00:00.000Z"), "Asia/Tokyo");
  const nextDayGroups = groupCompletedCleaningHistory(items, new Date("2026-09-03T06:00:00.000Z"), "Asia/Tokyo");

  assert.equal(todayGroups[0].kind, "today");
  assert.equal(nextDayGroups[0].kind, "yesterday");
  assert.equal(nextDayGroups[0].items[0].id, "completed");
});

test("완료 이력은 서버 페이지네이션과 completedAt 내림차순을 유지한다", () => {
  const repository = readFileSync("src/features/cleaning/server/cleaning.repository.ts", "utf8");
  assert.match(repository, /orderBy: \[\{ completedAt: "desc" \}, \{ scheduledDate: "desc" \}, \{ id: "desc" \}\]/);
  assert.match(repository, /skip: \(historyPage - 1\) \* SECTION_PAGE_SIZE/);
  assert.match(repository, /take: SECTION_PAGE_SIZE/);
  assert.doesNotMatch(repository, /historyRows[\s\S]{0,240}scheduledDate: \{ (?:gte|gt|lte|lt):/);
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
  assert.match(component, /groupCompletedCleaningHistory/);
  assert.match(component, /data-cleaning-history-date/);
  assert.match(component, /history\.groups\.count/);
});
