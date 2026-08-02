import assert from "node:assert/strict";
import test from "node:test";

import { getCleaningDateInput, parseCleaningDate, shiftCleaningDate } from "../domain/cleaning-date";

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
