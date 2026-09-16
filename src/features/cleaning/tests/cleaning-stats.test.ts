import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CLEANING_STATS_UNSPECIFIED_VALUE } from "../cleaning-stats.types";
import { isCleaningRecordCompleted } from "../domain/cleaning-record-status";
import { getCleaningStatsPresetRange, parseCleaningStatsRange } from "../domain/cleaning-stats-date";
import {
  buildCleaningStatsTaskWhere,
  getCleaningStatsWorkerName,
  sortCleaningStatsGroups,
} from "../domain/cleaning-stats-policy";

const read = (path: string) => readFileSync(path, "utf8");
const now = new Date("2026-09-01T12:00:00+09:00");

test("청소 실적 빠른 기간은 Asia/Tokyo 기준 오늘·이번 주·이번 달을 만든다", () => {
  assert.deepEqual(getCleaningStatsPresetRange("today", now), { from: "2026-09-01", to: "2026-09-01" });
  assert.deepEqual(getCleaningStatsPresetRange("this-week", now), { from: "2026-08-31", to: "2026-09-06" });
  assert.deepEqual(getCleaningStatsPresetRange("this-month", now), { from: "2026-09-01", to: "2026-09-30" });
});

test("실적 기간은 completedAt의 시작 포함·종료 다음날 미포함 경계를 사용한다", () => {
  const range = parseCleaningStatsRange({ from: "2026-09-01", to: "2026-09-03", now });
  assert.equal(range.start.toISOString(), "2026-08-31T15:00:00.000Z");
  assert.equal(range.toExclusive.toISOString(), "2026-09-03T15:00:00.000Z");
  const where = buildCleaningStatsTaskWhere({ start: range.start, toExclusive: range.toExclusive });
  assert.deepEqual(where, { AND: [
    { status: "COMPLETED" },
    { completedAt: { gte: range.start, lt: range.toExclusive } },
    {},
  ] });
});

test("PENDING·IN_PROGRESS·CANCELLED는 제외하고 COMPLETED만 DB 집계한다", () => {
  const repository = read("src/features/cleaning/server/cleaning-stats.repository.ts");
  const policy = read("src/features/cleaning/domain/cleaning-stats-policy.ts");
  assert.match(policy, /\{ status: "COMPLETED" \}/);
  assert.match(repository, /COALESCE\(task\."cleanerName", completed_user\."name", task\."completedByName"\)/);
  assert.match(repository, /COUNT\(\*\)::int/);
  assert.doesNotMatch(repository, /photos[\s\S]{0,120}COUNT\(\*\)|COUNT\(\*\)[\s\S]{0,120}photos/);
});

test("김철수 2건·박영희 1건·미입력 1건 aggregate 결과를 건수 내림차순으로 유지한다", () => {
  assert.deepEqual(sortCleaningStatsGroups([
    { cleanerName: "박영희", count: 1 },
    { cleanerName: null, count: 1 },
    { cleanerName: "김철수", count: 2 },
  ]), [
    { cleanerName: "김철수", count: 2 },
    { cleanerName: null, count: 1 },
    { cleanerName: "박영희", count: 1 },
  ]);
});

test("미입력·숙소·직원 필터는 DB where에 직접 적용한다", () => {
  const start = new Date("2026-08-31T15:00:00Z");
  const toExclusive = new Date("2026-09-30T15:00:00Z");
  const missing = buildCleaningStatsTaskWhere({ start, toExclusive, propertyId: "property-a", cleanerName: CLEANING_STATS_UNSPECIFIED_VALUE });
  assert.deepEqual(missing, { AND: [
    { status: "COMPLETED" },
    { completedAt: { gte: start, lt: toExclusive } },
    { propertyId: "property-a" },
    { AND: [
      { cleanerName: null },
      { completedBy: { is: null } },
      { completedByName: null },
    ] },
  ] });
  const named = buildCleaningStatsTaskWhere({ start, toExclusive, cleanerName: "사토" });
  assert.deepEqual(named, { AND: [
    { status: "COMPLETED" },
    { completedAt: { gte: start, lt: toExclusive } },
    { OR: [
      { cleanerName: "사토" },
      { AND: [{ cleanerName: null }, { completedBy: { is: { name: "사토" } } }] },
      { AND: [
        { cleanerName: null },
        { completedBy: { is: null } },
        { completedByName: "사토" },
      ] },
    ] },
  ] });
});

test("날짜별 집계는 Asia/Tokyo SQL aggregate, 상세는 서버 페이지네이션과 필요한 관계만 사용한다", () => {
  const repository = read("src/features/cleaning/server/cleaning-stats.repository.ts");
  assert.match(repository, /completedAt" AT TIME ZONE \$\{range\.timeZone\}/);
  assert.match(repository, /GROUP BY 1, 2/);
  assert.match(repository, /skip: \(safeDetailPage - 1\) \* DETAIL_PAGE_SIZE/);
  assert.match(repository, /take: DETAIL_PAGE_SIZE/);
  assert.match(repository, /_count: \{ select: \{ photos:/);
});

test("완료 직원은 실제 청소 직원명에서 처리 계정으로 fallback하고 사진·메모와 무관하게 집계한다", () => {
  const records = [
    { status: "COMPLETED" as const, completedAt: new Date(), cleanerName: null, completedBy: { name: "병진" }, completedByName: "병진", photoCount: 0, note: null },
    { status: "COMPLETED" as const, completedAt: new Date(), cleanerName: "세로", completedBy: { name: "처리 계정" }, completedByName: "처리 계정", photoCount: 2, note: "완료" },
    { status: "COMPLETED" as const, completedAt: new Date(), cleanerName: null, completedBy: { name: "신텐직원" }, completedByName: "신텐직원", photoCount: 0, note: null },
    { status: "COMPLETED" as const, completedAt: new Date(), cleanerName: null, completedBy: null, completedByName: null, photoCount: 0, note: null },
    { status: "PENDING" as const, completedAt: null, cleanerName: "병진", completedBy: { name: "병진" }, completedByName: "병진", photoCount: 0, note: null },
    { status: "IN_PROGRESS" as const, completedAt: null, cleanerName: null, completedBy: null, completedByName: null, photoCount: 2, note: null },
  ];
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!isCleaningRecordCompleted(record)) continue;
    const workerName = getCleaningStatsWorkerName(record) ?? CLEANING_STATS_UNSPECIFIED_VALUE;
    counts.set(workerName, (counts.get(workerName) ?? 0) + 1);
  }

  assert.deepEqual(Object.fromEntries(counts), {
    "병진": 1,
    "세로": 1,
    "신텐직원": 1,
    [CLEANING_STATS_UNSPECIFIED_VALUE]: 1,
  });
  assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 4);
});

test("실제 청소 직원명과 처리 계정이 모두 없을 때만 미입력이다", () => {
  assert.equal(getCleaningStatsWorkerName({ cleanerName: null, completedBy: { name: "병진" }, completedByName: null }), "병진");
  assert.equal(getCleaningStatsWorkerName({ cleanerName: null, completedBy: null, completedByName: "과거 처리자" }), "과거 처리자");
  assert.equal(getCleaningStatsWorkerName({ cleanerName: null, completedBy: null, completedByName: null }), null);
});

test("완료 내역 상태는 사진·메모가 아닌 CleaningTask 완료 상태로 판정한다", () => {
  assert.equal(isCleaningRecordCompleted({
    status: "COMPLETED",
    completedAt: "2026-09-01T03:00:00.000Z",
    photoCount: 0,
    note: null,
  }), true);
  assert.equal(isCleaningRecordCompleted({
    status: "COMPLETED",
    completedAt: "2026-09-01T03:00:00.000Z",
    photoCount: 3,
    note: null,
  }), true);
  assert.equal(isCleaningRecordCompleted({
    status: "PENDING",
    completedAt: null,
    photoCount: 0,
    note: null,
  }), false);
  assert.equal(isCleaningRecordCompleted({
    status: "IN_PROGRESS",
    completedAt: "2026-09-01T03:00:00.000Z",
  }), true);
});

test("과거 완료 기록은 새로고침 후에도 사진 수와 무관하게 완료로 표시한다", () => {
  const refreshed = JSON.parse(JSON.stringify({
    status: "COMPLETED",
    completedAt: "2026-08-01T03:00:00.000Z",
    photoCount: 0,
    note: null,
  })) as Parameters<typeof isCleaningRecordCompleted>[0];
  const repository = read("src/features/cleaning/server/cleaning-stats.repository.ts");
  const page = read("src/app/cleaning/stats/page.tsx");
  const statusPolicy = read("src/features/cleaning/domain/cleaning-record-status.ts");

  assert.equal(isCleaningRecordCompleted(refreshed), true);
  assert.match(repository, /select: \{[\s\S]*?id: true,[\s\S]*?status: true,[\s\S]*?completedAt: true/);
  assert.match(page, /const completed = isCleaningRecordCompleted\(detail\)/);
  assert.match(page, /completed \? t\("details\.completed"\) : t\("unspecified"\)/);
  assert.equal(page.match(/data-cleaning-record-status/g)?.length, 1);
  assert.doesNotMatch(page, /cleanerLabel\(detail\.cleanerName\)/);
  assert.doesNotMatch(statusPolicy, /photoCount|photos|note|memo/);
});
