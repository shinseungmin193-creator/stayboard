import assert from "node:assert/strict";
import test from "node:test";

import { formatCleaningSelectedDate, getCleaningDateInput, parseCleaningDate, shiftCleaningDate } from "../domain/cleaning-date";

test("cleaning date uses the configured company or property timezone", () => {
  const now = new Date("2026-08-02T16:30:00.000Z");
  assert.equal(getCleaningDateInput(now, "Asia/Tokyo"), "2026-08-03");
  assert.equal(getCleaningDateInput(now, "America/Los_Angeles"), "2026-08-02");
});

test("timezone day boundaries account for daylight saving time", () => {
  const { start, end } = parseCleaningDate("2026-03-08", new Date(), "America/Los_Angeles");
  assert.equal((end.getTime() - start.getTime()) / 3_600_000, 23);
});

test("date navigation is calendar based", () => {
  assert.equal(shiftCleaningDate("2026-02-28", 1), "2026-03-01");
});

test("selected cleaning date includes the localized weekday", () => {
  assert.equal(formatCleaningSelectedDate({ date: "2026-08-03", locale: "ko", timeZone: "Asia/Tokyo" }), "2026년 8월 3일 (월)");
  assert.equal(formatCleaningSelectedDate({ date: "2026-08-03", locale: "ja", timeZone: "Asia/Tokyo" }), "2026年8月3日（月）");
});

test("selected date formatting does not shift across operating timezones", () => {
  assert.equal(formatCleaningSelectedDate({ date: "2026-08-03", locale: "ko-KR", timeZone: "America/Los_Angeles" }), "2026년 8월 3일 (월)");
  assert.equal(formatCleaningSelectedDate({ date: "2026-08-03", locale: "ja-JP", timeZone: "Invalid/Timezone" }), "2026年8月3日（月）");
});

test("all seven weekday labels follow the Korean and Japanese locale", () => {
  const dates = ["2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08"];
  assert.deepEqual(dates.map((date) => formatCleaningSelectedDate({ date, locale: "ko", timeZone: "Asia/Tokyo" }).slice(-2, -1)), ["일", "월", "화", "수", "목", "금", "토"]);
  assert.deepEqual(dates.map((date) => formatCleaningSelectedDate({ date, locale: "ja", timeZone: "Asia/Tokyo" }).slice(-2, -1)), ["日", "月", "火", "水", "木", "金", "土"]);
});
