import assert from "node:assert/strict";
import test from "node:test";

import { getCleaningTimeStatus } from "../domain/cleaning-time";

const referenceAt = new Date("2026-08-03T03:00:00.000Z");

test("remaining cleaning time includes hours and minutes", () => {
  assert.deepEqual(getCleaningTimeStatus({ targetAt: new Date("2026-08-03T06:30:00.000Z"), referenceAt }), { kind: "remaining", hours: 3, minutes: 30 });
});

test("delayed cleaning time is reported without a negative duration", () => {
  assert.deepEqual(getCleaningTimeStatus({ targetAt: new Date("2026-08-03T02:40:00.000Z"), referenceAt }), { kind: "delayed", hours: 0, minutes: 20 });
});

test("completed cleaning tasks do not show a running duration", () => {
  assert.deepEqual(getCleaningTimeStatus({ targetAt: new Date("2026-08-03T06:00:00.000Z"), referenceAt, completedAt: referenceAt }), { kind: "completed" });
});
