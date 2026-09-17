import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReservationOverlapWhere,
  reservationOverlapsRange,
} from "../reservation-range-overlap";

const viewStart = new Date("2026-09-10T15:00:00.000Z");
const viewEnd = new Date("2026-09-27T15:00:00.000Z");
const overlaps = (startDate: string, endDate: string) => reservationOverlapsRange(
  { startDate: new Date(startDate), endDate: new Date(endDate) },
  { viewStart, viewEnd },
);

test("캘린더 Prisma 조건은 [startDate, endDate) overlap만 사용한다", () => {
  assert.deepEqual(buildReservationOverlapWhere({ viewStart, viewEnd }), {
    startDate: { lt: viewEnd },
    endDate: { gt: viewStart },
  });
});

test("오늘 9/17이어도 9/15~9/17 예약은 조회 기간과 겹친다", () => {
  assert.equal(overlaps("2026-09-14T15:00:00.000Z", "2026-09-16T15:00:00.000Z"), true);
});

test("조회 시작·종료 경계에 걸친 예약을 반개방 구간으로 판정한다", () => {
  assert.equal(overlaps("2026-09-09T15:00:00.000Z", "2026-09-11T15:00:00.000Z"), true);
  assert.equal(overlaps("2026-09-26T15:00:00.000Z", "2026-09-29T15:00:00.000Z"), true);
  assert.equal(overlaps("2026-08-31T15:00:00.000Z", "2026-09-04T15:00:00.000Z"), false);
  assert.equal(overlaps("2026-09-08T15:00:00.000Z", "2026-09-10T15:00:00.000Z"), false);
  assert.equal(overlaps("2026-09-27T15:00:00.000Z", "2026-09-29T15:00:00.000Z"), false);
});
