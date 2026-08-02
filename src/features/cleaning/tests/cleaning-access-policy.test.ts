import assert from "node:assert/strict";
import test from "node:test";

import { canWorkOnCleaningTask } from "../domain/cleaning-access-policy";

test("staff can work on unassigned or self-assigned cleaning tasks", () => {
  assert.equal(canWorkOnCleaningTask({ role: "STAFF", userId: "staff-a", assignedToId: null }), true);
  assert.equal(canWorkOnCleaningTask({ role: "STAFF", userId: "staff-a", assignedToId: "staff-a" }), true);
  assert.equal(canWorkOnCleaningTask({ role: "STAFF", userId: "staff-a", assignedToId: "staff-b" }), false);
  assert.equal(canWorkOnCleaningTask({ role: "STAFF", userId: "staff-a", assignedToId: null, assigneeName: "외부 직원", assignedById: "staff-a" }), true);
  assert.equal(canWorkOnCleaningTask({ role: "STAFF", userId: "staff-a", assignedToId: null, assigneeName: "외부 직원", assignedById: "staff-b" }), false);
});

test("administrators can work on assigned and unassigned cleaning tasks", () => {
  assert.equal(canWorkOnCleaningTask({ role: "ADMIN", userId: "admin", assignedToId: "staff-a" }), true);
  assert.equal(canWorkOnCleaningTask({ role: "DEVELOPER", userId: "developer", assignedToId: null }), true);
});
