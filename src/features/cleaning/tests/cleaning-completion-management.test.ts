import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("완료 수정·취소는 ADMIN/DEVELOPER 중앙 권한을 서버에서 검증한다", () => {
  const access = read("src/features/access-control/domain/access-control.ts");
  const actions = read("src/features/cleaning/cleaning.actions.ts");
  assert.match(access, /CLEANING_COMPLETION_MANAGE: "cleaning-completion\.manage"/);
  assert.match(actions, /updateCleaningCompletionAction[\s\S]*PERMISSIONS\.CLEANING_COMPLETION_MANAGE/);
  assert.match(actions, /revertCleaningCompletionAction[\s\S]*PERMISSIONS\.CLEANING_COMPLETION_MANAGE/);
});

test("완료 수정은 원본 task의 실적 담당자·시각·메모를 원자적으로 변경한다", () => {
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  const update = service.slice(service.indexOf("export async function updateCleaningCompletion"), service.indexOf("export async function revertCleaningCompletion"));
  assert.match(update, /prisma\.\$transaction/);
  assert.match(update, /where: \{ id: taskId, status: "COMPLETED", updatedAt: task\.updatedAt \}/);
  assert.match(update, /data: update/);
  assert.match(update, /action: "COMPLETION_UPDATED"/);
  assert.match(update, /before:[\s\S]*after:/);
});

test("완료 취소는 완료 필드만 지우고 배정·사진·메모를 보존한다", () => {
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  const revert = service.slice(service.indexOf("export async function revertCleaningCompletion"), service.indexOf("export async function saveCleaningTaskNote"));
  assert.match(revert, /where: \{ id: taskId, status: "COMPLETED", updatedAt: task\.updatedAt \}/);
  assert.match(revert, /action: "COMPLETION_REVERTED"/);
  assert.match(revert, /data: \{ deleteAfter: null, deleteError: null \}/);
  assert.doesNotMatch(revert, /cleaningTask\.(delete|deleteMany)/);
  assert.doesNotMatch(revert, /cleaningPhoto\.(delete|deleteMany)/);
  assert.doesNotMatch(revert, /roomNote\.(delete|deleteMany)/);
  assert.doesNotMatch(revert, /assignedToId:\s*null|assigneeName:\s*null|note:\s*null/);
});

test("담당자 수정과 완료 취소는 원본 CleaningTask 기반 실적·완료 이력에 반영된다", () => {
  const stats = read("src/features/cleaning/server/cleaning-stats.repository.ts");
  const repository = read("src/features/cleaning/server/cleaning.repository.ts");
  assert.match(stats, /task\."status" = 'COMPLETED'/);
  assert.match(stats, /COALESCE\(task\."cleanerName"/);
  assert.match(repository, /where: completedWhere/);
  assert.match(repository, /cleanerName: task\.cleanerName/);
});

test("완료 사진은 관리자만 추가·삭제할 수 있고 0장이 되어도 task 상태를 변경하지 않는다", () => {
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  const upload = read("src/app/api/cleaning/tasks/[taskId]/photos/route.ts");
  const deletion = read("src/app/api/cleaning/photos/[photoId]/route.ts");
  const uploader = read("src/features/cleaning/components/cleaning-photo-uploader.tsx");
  assert.match(upload, /task\.status === "COMPLETED" && canManageCompleted/);
  assert.match(deletion, /CLEANING_COMPLETION_MANAGE/);
  assert.match(deletion, /action: "PHOTO_REMOVED"|recordCleaningPhotoRemoved/);
  assert.doesNotMatch(deletion, /cleaningTask\.update/);
  assert.match(uploader, /window\.confirm\(t\("photos\.deleteConfirm"\)\)/);
  assert.match(uploader, /allowEmpty \? "photos\.none" : "photos\.required"/);
  const completion = service.slice(service.indexOf("export async function completeCleaningTask"), service.indexOf("export async function updateCleaningCompletion"));
  assert.doesNotMatch(completion, /PHOTO_REQUIRED|photos\.length/);
});

test("완료 카드 메뉴와 반응형 dialog는 수정·destructive 완료 취소를 제공한다", () => {
  const card = read("src/features/cleaning/components/cleaning-task-card.tsx");
  const editDialog = read("src/features/cleaning/components/cleaning-completion-edit-dialog.tsx");
  const revertDialog = read("src/features/cleaning/components/cleaning-completion-revert-dialog.tsx");
  assert.match(card, /isCompleted && canManageCompletion[\s\S]*editCompletion/);
  assert.match(card, /isCompleted && canManageCompletion[\s\S]*revertCompletion/);
  assert.match(editDialog, /sm:max-w-2xl/);
  assert.match(editDialog, /allowEmpty/);
  assert.match(revertDialog, /variant="destructive"/);
});
