import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CLEANING_STATS_UNSPECIFIED_VALUE } from "../cleaning-stats.types";
import { getCleaningStatsPresetRange, parseCleaningStatsRange } from "../domain/cleaning-stats-date";
import { buildCleaningStatsTaskWhere, sortCleaningStatsGroups } from "../domain/cleaning-stats-policy";

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
  assert.match(repository, /groupBy\(\{ by: \["cleanerName"\], where/);
  assert.match(repository, /COUNT\(\*\)::int/);
  assert.doesNotMatch(repository, /findMany\([\s\S]{0,200}groupBy\(/);
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
    { cleanerName: null },
  ] });
  const named = buildCleaningStatsTaskWhere({ start, toExclusive, cleanerName: "사토" });
  assert.deepEqual(named, { AND: [
    { status: "COMPLETED" },
    { completedAt: { gte: start, lt: toExclusive } },
    { cleanerName: "사토" },
  ] });
});

test("날짜별 집계는 Asia/Tokyo SQL aggregate, 상세는 서버 페이지네이션과 필요한 관계만 사용한다", () => {
  const repository = read("src/features/cleaning/server/cleaning-stats.repository.ts");
  assert.match(repository, /completedAt" AT TIME ZONE \$\{range\.timeZone\}/);
  assert.match(repository, /GROUP BY 1, task\."cleanerName"/);
  assert.match(repository, /skip: \(safeDetailPage - 1\) \* DETAIL_PAGE_SIZE/);
  assert.match(repository, /take: DETAIL_PAGE_SIZE/);
  assert.match(repository, /_count: \{ select: \{ photos:/);
});
