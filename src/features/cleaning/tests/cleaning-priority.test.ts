import assert from "node:assert/strict";
import test from "node:test";

import { classifyCleaningPriority } from "../domain/cleaning-priority";

const start = new Date("2026-07-24T15:00:00.000Z");
const end = new Date("2026-07-25T15:00:00.000Z");

test("same-day checkout with a check-in is urgent", () => {
  assert.equal(classifyCleaningPriority(
    new Date("2026-07-25T01:00:00.000Z"),
    [new Date("2026-07-25T06:00:00.000Z")],
    start,
    end,
  ), "urgent");
});

test("same-day checkout without a check-in is flexible", () => {
  assert.equal(classifyCleaningPriority(new Date("2026-07-25T01:00:00.000Z"), [], start, end), "flexible");
});

test("Tokyo 자정에 정확히 끝나는 1박 예약도 오늘 청소로 포함한다", () => {
  assert.equal(classifyCleaningPriority(start, [], start, end), "flexible");
  assert.equal(classifyCleaningPriority(start, [start], start, end), "urgent");
});

test("checkout outside the selected day is excluded", () => {
  assert.equal(classifyCleaningPriority(new Date("2026-07-26T01:00:00.000Z"), [], start, end), null);
});
