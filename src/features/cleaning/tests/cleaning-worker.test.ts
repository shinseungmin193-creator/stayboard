import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import {
  getCleaningWorkerNormalizedName,
  getSelectableCleaningWorkers,
  normalizeCleaningWorkerDisplayName,
  upsertCleaningWorkerList,
} from "../domain/cleaning-worker";

const read = (path: string) => readFileSync(path, "utf8");

test("등록 이름은 공백·Unicode·대소문자를 정규화한다", () => {
  assert.equal(normalizeCleaningWorkerDisplayName("  김   철수  "), "김 철수");
  assert.equal(getCleaningWorkerNormalizedName("ＳＡＴＯ"), "sato");
  assert.equal(getCleaningWorkerNormalizedName(" Sato "), "sato");
});

test("같은 회사의 정규화 이름은 중복 등록할 수 없다", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260901120000_add_cleaning_workers_and_stats/migration.sql");
  assert.match(schema, /model CleaningWorker[\s\S]*normalizedName String[\s\S]*isActive\s+Boolean[\s\S]*@@unique\(\[companyId, normalizedName\]\)/);
  assert.match(migration, /CleaningWorker_companyId_normalizedName_key/);
});

test("다른 회사에는 같은 정규화 이름을 등록할 수 있다", () => {
  const normalizedName = getCleaningWorkerNormalizedName(" 김민수 ");
  assert.notEqual(`company-a:${normalizedName}`, `company-b:${normalizedName}`);
  assert.match(read("prisma/schema.prisma"), /@@unique\(\[companyId, normalizedName\]\)/);
});

test("ADMIN은 청소 직원을 등록·수정·비활성화할 수 있다", () => {
  assert.equal(hasPermission("ADMIN", PERMISSIONS.CLEANING_WORKER_MANAGE), true);
});

test("DEVELOPER는 청소 직원을 등록·수정·비활성화할 수 있다", () => {
  assert.equal(hasPermission("DEVELOPER", PERMISSIONS.CLEANING_WORKER_MANAGE), true);
});

test("STAFF는 선택과 직접 입력만 가능하고 서버 등록 권한도 없다", () => {
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_WORKER_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_WORKER_READ), true);
  const actions = read("src/features/cleaning/cleaning-worker.actions.ts");
  const repository = read("src/features/cleaning/server/cleaning-worker.repository.ts");
  assert.match(actions, /requireCompanyAccess\(parsed\.data\.companyId, PERMISSIONS\.CLEANING_WORKER_MANAGE\)/);
  assert.match(actions, /requirePermission\(PERMISSIONS\.CLEANING_WORKER_MANAGE\)/);
  assert.match(repository, /findCleaningWorker\(context: AccessContext/);
  assert.match(repository, /options\.includeInactive && canManage/);
});

test("등록 성공 직후 공유 목록에 추가되고 방금 등록한 직원이 선택된다", () => {
  const dialog = read("src/features/cleaning/components/cleaning-workflow-dialog.tsx");
  const workspace = read("src/features/cleaning/components/cleaning-workspace.tsx");
  const registrationDialog = read("src/features/cleaning/components/cleaning-worker-registration-dialog.tsx");
  const worker = { id: "worker-a", companyId: "company-a", companyName: "A", name: "김민수", isActive: true };
  assert.deepEqual(upsertCleaningWorkerList([], worker), [worker]);
  assert.match(registrationDialog, /onCreated\(result\.data\);[\s\S]*onOpenChange\(false\)/);
  assert.match(dialog, /onWorkerCreated\(worker\);[\s\S]*setSelectedWorkerId\(worker\.id\);[\s\S]*setWorkerName\(worker\.name\)/);
  assert.match(workspace, /registeredWorkers=\{workers\}/);
});

test("활성 직원만 같은 회사 dropdown에 노출되고 비활성 직원은 제외된다", () => {
  const workers = [
    { id: "a", companyId: "company-a", companyName: "A", name: "김민수", isActive: true },
    { id: "b", companyId: "company-a", companyName: "A", name: "박민수", isActive: false },
    { id: "c", companyId: "company-b", companyName: "B", name: "사토", isActive: true },
  ];
  assert.deepEqual(getSelectableCleaningWorkers(workers, "company-a").map((worker) => worker.id), ["a"]);
  assert.match(read("src/features/cleaning/components/cleaning-worker-manager.tsx"), /workers\.filter\(\(worker\) => worker\.companyId === companyId\)/);
});

test("등록 직원 선택은 cleanerName 입력값을 채우고 직접 수정하면 등록 선택을 해제한다", () => {
  const dialog = read("src/features/cleaning/components/cleaning-workflow-dialog.tsx");
  assert.match(dialog, /setWorkerName\(selected\.name\)/);
  assert.match(dialog, /setSelectedWorkerId\(""\); setWorkerName\(event\.target\.value\)/);
});

test("직접 입력한 이름은 CleaningWorker로 자동 등록하지 않는다", () => {
  const workspace = read("src/features/cleaning/components/cleaning-workspace.tsx");
  assert.match(workspace, /startCleaningTaskAction\(\{ taskId: input\.task\.id, workerName: input\.workerName \}\)/);
  assert.doesNotMatch(workspace, /startCleaningTaskAction[\s\S]{0,160}createCleaningWorkerAction/);
});

test("청소 시작 Dialog는 로그인 사용자 이름을 자동 입력하지 않고 빈 이름으로 시작한다", () => {
  const workflow = read("src/features/cleaning/domain/cleaning-workflow.ts");
  assert.match(workflow, /if \(input\.mode === "start"\) return ""/);
  const dialog = read("src/features/cleaning/components/cleaning-workflow-dialog.tsx");
  assert.match(dialog, /setSelectedWorkerId\(""\); setWorkerName\(currentUserName\)/);
});

test("비활성화는 dropdown에서만 제외하며 과거 CleaningTask와 통계는 유지한다", () => {
  const migration = read("prisma/migrations/20260901120000_add_cleaning_workers_and_stats/migration.sql");
  const workerRepository = read("src/features/cleaning/server/cleaning-worker.repository.ts");
  const statsRepository = read("src/features/cleaning/server/cleaning-stats.repository.ts");
  const statsPolicy = read("src/features/cleaning/domain/cleaning-stats-policy.ts");
  assert.match(migration, /Existing CleaningTask rows intentionally keep cleanerName NULL/);
  assert.doesNotMatch(migration, /UPDATE "CleaningTask"/);
  assert.match(workerRepository, /data: \{ isActive: input\.isActive \}/);
  assert.doesNotMatch(workerRepository, /cleaningTask\.(?:update|delete)/);
  assert.match(statsPolicy, /status: "COMPLETED"/);
  assert.match(statsRepository, /groupBy\(\{ by: \["cleanerName"\]/);
  assert.doesNotMatch(statsRepository, /cleaningWorkerId/);
});

test("실제 청소 직원과 시작·완료 처리 계정 스냅샷은 CleaningTask에서 별도 필드로 저장한다", () => {
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  assert.match(service, /startedById: input\.userId,[\s\S]*startedByName: input\.name,[\s\S]*cleanerName: workerName/);
  assert.match(service, /completedById: input\.userId,[\s\S]*completedByName: input\.name,[\s\S]*cleanerName: workerName/);
});
