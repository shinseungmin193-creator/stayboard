import assert from "node:assert/strict";
import test from "node:test";

import { getCleaningPhotoDeleteAfter } from "../domain/cleaning-retention";

test("completed cleaning photos are scheduled for deletion after exactly seven days", () => {
  const completedAt = new Date("2026-08-03T04:30:00.000Z");
  assert.equal(getCleaningPhotoDeleteAfter(completedAt).toISOString(), "2026-08-10T04:30:00.000Z");
});
