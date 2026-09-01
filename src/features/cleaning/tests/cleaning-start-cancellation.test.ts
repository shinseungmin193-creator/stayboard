import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CleaningWorkflowError,
  planCleaningStart,
  planCleaningStartCancellation,
  type CleaningWorkflowSnapshot,
} from "../domain/cleaning-workflow";

const read = (path: string) => readFileSync(path, "utf8");

test("PENDING 작업을 시작한 뒤 IN_PROGRESS 시작 상태만 PENDING으로 되돌린다", () => {
  const pending: CleaningWorkflowSnapshot = {
    status: "PENDING",
    assigneeUserId: "staff-a",
    assigneeName: "김철수",
    assignedByUserId: "admin-a",
  };
  assert.deepEqual(planCleaningStart(pending, "김철수"), { shouldAssign: false, workerName: "김철수" });
  assert.deepEqual(planCleaningStartCancellation("IN_PROGRESS"), {
    status: "PENDING",
    startedAt: null,
    startedById: null,
    startedByName: null,
    cleanerName: null,
  });
});

test("시작 취소는 사진·메모·RoomNote·배정 정보를 보존한다", () => {
  const photos = [{ id: "photo-a" }];
  const logs = [{ action: "STARTED" }];
  const roomNote = { id: "note-a" };
  const before = {
    status: "IN_PROGRESS" as const,
    startedAt: new Date("2026-09-01T00:00:00Z"),
    startedById: "actor-a",
    startedByName: "처리 계정",
    cleanerName: "실제 직원",
    assignedToId: "staff-a",
    assigneeName: "담당 직원",
    note: "현장 메모",
    photos,
    logs,
    roomNote,
  };
  const after = { ...before, ...planCleaningStartCancellation(before.status) };
  assert.equal(after.status, "PENDING");
  assert.equal(after.startedAt, null);
  assert.equal(after.startedById, null);
  assert.equal(after.startedByName, null);
  assert.equal(after.cleanerName, null);
  assert.equal(after.assignedToId, before.assignedToId);
  assert.equal(after.assigneeName, before.assigneeName);
  assert.equal(after.note, before.note);
  assert.equal(after.photos, photos);
  assert.equal(after.logs, logs);
  assert.equal(after.roomNote, roomNote);
});

test("COMPLETED와 시작 전 상태는 시작 취소할 수 없다", () => {
  assert.throws(
    () => planCleaningStartCancellation("COMPLETED"),
    (error) => error instanceof CleaningWorkflowError && error.code === "ALREADY_COMPLETED",
  );
  assert.throws(
    () => planCleaningStartCancellation("PENDING"),
    (error) => error instanceof CleaningWorkflowError && error.code === "NOT_IN_PROGRESS",
  );
});

test("시작 취소 후 같은 작업을 다시 시작할 수 있다", () => {
  const reset = planCleaningStartCancellation("IN_PROGRESS");
  assert.deepEqual(planCleaningStart({
    status: reset.status,
    assigneeUserId: "staff-a",
    assigneeName: "담당 직원",
    assignedByUserId: "admin-a",
  }, "다시 시작한 직원"), { shouldAssign: false, workerName: "다시 시작한 직원" });
});

test("서비스는 IN_PROGRESS와 updatedAt을 함께 비교하고 사진·메모를 변경하지 않는다", () => {
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  const cancellation = service.slice(
    service.indexOf("export async function cancelCleaningTaskStart"),
    service.indexOf("export async function completeCleaningTask"),
  );
  assert.match(cancellation, /updateMany\(\{[\s\S]*where: \{ id: taskId, status: "IN_PROGRESS", updatedAt: task\.updatedAt \}/);
  assert.match(cancellation, /if \(!updated\.count\) throw new CleaningTaskStateError\("CONFLICT"\)/);
  assert.doesNotMatch(cancellation, /cleaningPhoto\.(delete|deleteMany|update|updateMany)/);
  assert.doesNotMatch(cancellation, /roomNote\.(delete|deleteMany|update|updateMany)/);
  assert.doesNotMatch(cancellation, /data: \{[\s\S]*note:/);
});

test("STARTED 로그는 삭제하지 않고 START_CANCELLED 이력을 추가한다", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260901140000_add_cleaning_start_cancel_log/migration.sql");
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  assert.match(schema, /STARTED\s+START_CANCELLED\s+COMPLETED/);
  assert.match(migration, /ADD VALUE 'START_CANCELLED'/);
  assert.match(service, /action: "START_CANCELLED"[\s\S]*previousStatus: "IN_PROGRESS"[\s\S]*nextStatus: "PENDING"/);
  assert.doesNotMatch(service, /cleaningTaskLog\.delete/);
});

test("서버 권한과 카드 상태가 시작 취소 노출을 함께 제한한다", () => {
  const actions = read("src/features/cleaning/cleaning.actions.ts");
  const card = read("src/features/cleaning/components/cleaning-task-card.tsx");
  const dialog = read("src/features/cleaning/components/cleaning-start-cancel-dialog.tsx");
  assert.match(actions, /cancelCleaningTaskStartAction[\s\S]*requireCleaningTaskAccess\(parsed\.data\.taskId, PERMISSIONS\.CLEANING_MANAGE\)/);
  assert.match(card, /task\.status === "IN_PROGRESS" && <Button[\s\S]*data-cleaning-cancel-start-action/);
  assert.doesNotMatch(card, /task\.status === "COMPLETED" && <Button[\s\S]*data-cleaning-cancel-start-action/);
  assert.match(dialog, /preservedData/);
});

test("시작 취소된 PENDING 작업은 COMPLETED 전용 통계에 포함되지 않는다", () => {
  const policy = read("src/features/cleaning/domain/cleaning-stats-policy.ts");
  assert.match(policy, /\{ status: "COMPLETED" \}/);
});
