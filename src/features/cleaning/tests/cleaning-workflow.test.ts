import assert from "node:assert/strict";
import test from "node:test";

import { cleaningCompletionUpdateSchema, cleaningTaskAssignmentSchema, cleaningTaskCompletionSchema, cleaningTaskStartSchema } from "../cleaning.schemas";
import {
  CleaningWorkflowError,
  getInitialCleaningWorkflowWorkerName,
  normalizeCleaningWorkerName,
  planCleaningAssignment,
  planCleaningCompletion,
  planCleaningCompletionReversion,
  planCleaningCompletionUpdate,
  planCleaningStart,
  resolveCleaningAssignmentWorkerName,
  type CleaningWorkflowSnapshot,
} from "../domain/cleaning-workflow";

const unassigned: CleaningWorkflowSnapshot = { status: "PENDING", assigneeUserId: null, assigneeName: null, assignedByUserId: null };

test("청소 시작 Dialog의 실제 청소 직원 이름은 로그인 계정과 무관하게 빈 값으로 시작한다", () => {
  assert.equal(getInitialCleaningWorkflowWorkerName({
    mode: "start",
    cleanerName: null,
    assigneeName: "StayBoard Developer",
  }), "");
});

test("청소 완료 Dialog는 시작 시 저장한 실제 청소 직원 이름을 재사용한다", () => {
  assert.equal(getInitialCleaningWorkflowWorkerName({
    mode: "complete",
    cleanerName: "김철수",
    assigneeName: "StayBoard Developer",
  }), "김철수");
});

test("self assignment and directly entered worker names are normalized", () => {
  assert.equal(planCleaningAssignment(unassigned, "  김청소  ").workerName, "김청소");
  assert.equal(normalizeCleaningWorkerName("외부 작업자"), "외부 작업자");
});

test("empty or oversized worker names are rejected", () => {
  assert.throws(() => normalizeCleaningWorkerName("  "), (error) => error instanceof CleaningWorkflowError && error.code === "NAME_REQUIRED");
  assert.throws(() => normalizeCleaningWorkerName("가".repeat(31)), (error) => error instanceof CleaningWorkflowError && error.code === "NAME_REQUIRED");
});

test("staff assignments use the entered worker name as a task snapshot", () => {
  assert.equal(resolveCleaningAssignmentWorkerName({
    assigneeRole: "STAFF",
    accountName: "공용 청소 계정",
    workerName: "  김민수  ",
  }), "김민수");
});

test("admin and developer assignments use the trusted account name", () => {
  assert.equal(resolveCleaningAssignmentWorkerName({
    assigneeRole: "ADMIN",
    accountName: "신텐 관리자",
    workerName: "임의 이름",
  }), "신텐 관리자");
  assert.equal(resolveCleaningAssignmentWorkerName({
    assigneeRole: "DEVELOPER",
    accountName: "StayBoard Developer",
  }), "StayBoard Developer");
});

test("staff assignments require an actual worker name", () => {
  assert.throws(
    () => resolveCleaningAssignmentWorkerName({ assigneeRole: "STAFF", accountName: "공용 청소 계정" }),
    (error) => error instanceof CleaningWorkflowError && error.code === "NAME_REQUIRED",
  );
});

test("assignments require a real account id and reject null account ids", () => {
  assert.equal(cleaningTaskAssignmentSchema.safeParse({
    taskId: "task-a",
    assigneeUserId: "staff-a",
    workerName: "김민수",
  }).success, true);
  assert.equal(cleaningTaskAssignmentSchema.safeParse({
    taskId: "task-a",
    assigneeUserId: null,
    workerName: "김민수",
  }).success, false);
});

test("starting an unassigned task plans assignment and start as one workflow", () => {
  assert.deepEqual(planCleaningStart(unassigned, "당일 직원"), { shouldAssign: true, workerName: "당일 직원" });
});

test("starting an assigned pending task still requires an explicit actual cleaner name", () => {
  const assigned = { ...unassigned, assigneeUserId: "staff-a", assigneeName: "담당 직원" };
  assert.throws(() => planCleaningStart(assigned), (error) => error instanceof CleaningWorkflowError && error.code === "NAME_REQUIRED");
  assert.deepEqual(planCleaningStart(assigned, "실제 직원"), { shouldAssign: false, workerName: "실제 직원" });
});

test("start and completion server inputs require an explicit actual cleaner name", () => {
  assert.equal(cleaningTaskStartSchema.safeParse({ taskId: "task-a" }).success, false);
  assert.equal(cleaningTaskCompletionSchema.safeParse({ taskId: "task-a" }).success, false);
  assert.equal(cleaningTaskStartSchema.safeParse({ taskId: "task-a", workerName: "김철수" }).success, true);
  assert.equal(cleaningTaskCompletionSchema.safeParse({ taskId: "task-a", workerName: "사토" }).success, true);
});

test("completing an unassigned task plans assignment and completion together", () => {
  assert.deepEqual(planCleaningCompletion(unassigned, "완료 직원"), { shouldAssign: true, workerName: "완료 직원" });
});

test("already assigned tasks reject a concurrent claim", () => {
  const assigned = { ...unassigned, assigneeUserId: "staff-a", assigneeName: "직원 A" };
  assert.throws(() => planCleaningAssignment(assigned, "직원 B"), (error) => error instanceof CleaningWorkflowError && error.code === "ALREADY_ASSIGNED");
});

test("completed tasks cannot be completed again", () => {
  const completed = { ...unassigned, status: "COMPLETED" as const, assigneeName: "직원 A" };
  assert.throws(() => planCleaningCompletion(completed, "직원 A"), (error) => error instanceof CleaningWorkflowError && error.code === "NOT_ACTIONABLE");
});

test("완료 내용 수정은 완료 상태를 유지하며 담당자·완료 시각·메모를 정규화한다", () => {
  const completedAt = new Date("2026-09-18T04:30:00.000Z");
  assert.deepEqual(planCleaningCompletionUpdate({
    status: "COMPLETED",
    workerName: "  병진  ",
    completedAt,
    note: "  수정 메모  ",
  }), {
    cleanerName: "병진",
    completedAt,
    note: "수정 메모",
  });
  assert.equal(cleaningCompletionUpdateSchema.safeParse({
    taskId: "task-a",
    workerName: "병진",
    completedAt: completedAt.toISOString(),
    note: "",
  }).success, true);
});

test("완료 수정은 완료되지 않은 작업과 잘못된 완료 시각을 거부한다", () => {
  assert.throws(
    () => planCleaningCompletionUpdate({ status: "PENDING", workerName: "병진", completedAt: new Date(), note: "" }),
    (error) => error instanceof CleaningWorkflowError && error.code === "NOT_COMPLETED",
  );
  assert.throws(
    () => planCleaningCompletionUpdate({ status: "COMPLETED", workerName: "병진", completedAt: new Date(Number.NaN), note: "" }),
    (error) => error instanceof CleaningWorkflowError && error.code === "INVALID_COMPLETION_TIME",
  );
});

test("완료 취소는 직전 진행 상태를 복원하고 완료 정보만 초기화한다", () => {
  assert.deepEqual(planCleaningCompletionReversion({
    status: "COMPLETED",
    previousStatus: "IN_PROGRESS",
    startedAt: new Date("2026-09-18T03:00:00.000Z"),
  }), {
    status: "IN_PROGRESS",
    completedAt: null,
    completedById: null,
    completedByName: null,
  });
  assert.deepEqual(planCleaningCompletionReversion({
    status: "COMPLETED",
    previousStatus: "PENDING",
    startedAt: null,
  }), {
    status: "PENDING",
    completedAt: null,
    completedById: null,
    completedByName: null,
    startedAt: null,
    startedById: null,
    startedByName: null,
    cleanerName: null,
  });
});

test("완료 취소 후 같은 작업을 다시 완료할 수 있다", () => {
  const reverted = planCleaningCompletionReversion({ status: "COMPLETED", previousStatus: "PENDING", startedAt: null });
  assert.deepEqual(planCleaningCompletion({
    status: reverted.status,
    assigneeUserId: "staff-a",
    assigneeName: "세로",
    assignedByUserId: "admin-a",
  }, "세로"), { shouldAssign: false, workerName: "세로" });
});
