import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import {
  getCleaningWorkerNormalizedName,
  normalizeCleaningWorkerDisplayName,
} from "../domain/cleaning-worker";

const read = (path: string) => readFileSync(path, "utf8");

test("등록 이름은 공백·Unicode·대소문자를 정규화해 회사 내 중복 키를 만든다", () => {
  assert.equal(normalizeCleaningWorkerDisplayName("  김   철수  "), "김 철수");
  assert.equal(getCleaningWorkerNormalizedName("ＳＡＴＯ"), "sato");
  assert.equal(getCleaningWorkerNormalizedName(" Sato "), "sato");
});

test("CleaningWorker는 회사별 정규화 이름 unique와 soft-disable 정책을 사용한다", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260901120000_add_cleaning_workers_and_stats/migration.sql");
  assert.match(schema, /model CleaningWorker[\s\S]*normalizedName String[\s\S]*isActive\s+Boolean[\s\S]*@@unique\(\[companyId, normalizedName\]\)/);
  assert.match(migration, /CleaningWorker_companyId_normalizedName_key/);
  assert.match(migration, /Existing CleaningTask rows intentionally keep cleanerName NULL/);
  assert.doesNotMatch(migration, /UPDATE "CleaningTask"/);
});

test("관리자는 이름을 등록·수정·비활성화할 수 있고 STAFF는 서버 권한에서 차단된다", () => {
  assert.equal(hasPermission("DEVELOPER", PERMISSIONS.CLEANING_WORKER_MANAGE), true);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.CLEANING_WORKER_MANAGE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_WORKER_MANAGE), false);
  const actions = read("src/features/cleaning/cleaning-worker.actions.ts");
  const repository = read("src/features/cleaning/server/cleaning-worker.repository.ts");
  assert.match(actions, /requireCompanyAccess\(parsed\.data\.companyId, PERMISSIONS\.CLEANING_WORKER_MANAGE\)/);
  assert.match(actions, /requirePermission\(PERMISSIONS\.CLEANING_WORKER_MANAGE\)/);
  assert.match(repository, /findCleaningWorker\(context: AccessContext/);
  assert.match(repository, /options\.includeInactive && canManage/);
});

test("시작 Dialog는 등록 이름 선택·직접 입력·명시적 등록과 내 이름 사용을 분리한다", () => {
  const dialog = read("src/features/cleaning/components/cleaning-workflow-dialog.tsx");
  const workspace = read("src/features/cleaning/components/cleaning-workspace.tsx");
  assert.match(dialog, /setWorkerName\(selected\.name\)/);
  assert.match(dialog, /onClick=\{\(\) => setWorkerName\(currentUserName\)\}/);
  assert.match(dialog, /createCleaningWorkerAction\(\{ companyId: task\.companyId, name: normalizedName \}\)/);
  assert.match(workspace, /startCleaningTaskAction\(\{ taskId: input\.task\.id, workerName: input\.workerName \}\)/);
  assert.doesNotMatch(workspace, /startCleaningTaskAction[\s\S]{0,160}createCleaningWorkerAction/);
});

test("실제 청소 직원과 시작·완료 처리 계정 스냅샷은 CleaningTask에서 별도 필드로 저장한다", () => {
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  assert.match(service, /startedById: input\.userId,[\s\S]*startedByName: input\.name,[\s\S]*cleanerName: workerName/);
  assert.match(service, /completedById: input\.userId,[\s\S]*completedByName: input\.name,[\s\S]*cleanerName: workerName/);
});
