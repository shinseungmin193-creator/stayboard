import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import { getCleaningRoomNotePreview } from "../domain/cleaning-room-notes";

const read = (path: string) => readFileSync(path, "utf8");

test("OPEN 객실 메모 2건을 청소 카드 미리보기에 모두 표시한다", () => {
  const preview = getCleaningRoomNotePreview(["에어컨 소음", "욕실 실리콘"]);
  assert.deepEqual(preview, { items: ["에어컨 소음", "욕실 실리콘"], totalCount: 2, remainingCount: 0 });
});

test("OPEN 객실 메모가 없으면 미리보기도 비어 있다", () => {
  assert.deepEqual(getCleaningRoomNotePreview([]), { items: [], totalCount: 0, remainingCount: 0 });
  assert.match(read("src/features/cleaning/components/cleaning-room-note-summary.tsx"), /if \(!notes\.length\) return null/);
});

test("OPEN 객실 메모 5건은 카드에 2건만 요약하고 3건을 더보기로 남긴다", () => {
  const preview = getCleaningRoomNotePreview([1, 2, 3, 4, 5]);
  assert.deepEqual(preview.items, [1, 2]);
  assert.equal(preview.totalCount, 5);
  assert.equal(preview.remainingCount, 3);
});

test("현재 화면의 모든 roomId를 공통 RoomNote 저장소에 한 번만 전달해 N+1을 방지한다", () => {
  const cleaningRepository = read("src/features/cleaning/server/cleaning.repository.ts");
  const roomNoteRepository = read("src/features/room-notes/server/room-note.repository.ts");
  assert.equal((cleaningRepository.match(/listOpenRoomNotesForRooms\(/g) ?? []).length, 1);
  assert.match(cleaningRepository, /visibleRoomIds = sectionRows\.flatMap/);
  assert.match(roomNoteRepository, /roomId: \{ in: uniqueRoomIds \}/);
  assert.match(roomNoteRepository, /status: OPEN_ROOM_NOTE_STATUS/);
});

test("객실 메모 완료는 기존 RoomNote Server Action과 권한 검사를 그대로 재사용한다", () => {
  const dialog = read("src/features/cleaning/components/cleaning-room-notes-dialog.tsx");
  const action = read("src/features/room-notes/room-note.actions.ts");
  assert.match(dialog, /changeRoomNoteStatusAction\(\{ id: noteId, status: "COMPLETED" \}\)/);
  assert.match(action, /requireRoomNoteAccess\(parsed\.data\.id, PERMISSIONS\.ROOM_NOTE_COMPLETE\)/);
  for (const role of ["STAFF", "ADMIN", "DEVELOPER"] as const) {
    assert.equal(hasPermission(role, PERMISSIONS.ROOM_NOTE_COMPLETE), true);
  }
});

test("완료 성공 뒤 청소 화면과 객실 메모 화면을 같은 source of truth로 갱신한다", () => {
  const action = read("src/features/room-notes/room-note.actions.ts");
  const workspace = read("src/features/cleaning/components/cleaning-workspace.tsx");
  assert.match(action, /revalidatePath\("\/room-notes"\)[\s\S]*revalidatePath\("\/cleaning"\)/);
  assert.match(workspace, /onCompleted=\{\(message\) => \{ showNotice\(message\); router\.refresh\(\); \}\}/);
});

test("RoomNote 완료는 CleaningTask 상태를 변경하지 않는다", () => {
  const service = read("src/features/room-notes/server/room-note.service.ts");
  const statusChange = service.slice(service.indexOf("export async function changeRoomNoteStatus"), service.indexOf("export async function deleteRoomNote"));
  assert.doesNotMatch(statusChange, /cleaningTask\.(update|updateMany)/);
});

test("CleaningTask 완료는 기존 OPEN RoomNote를 자동 완료하지 않는다", () => {
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  const completion = service.slice(service.indexOf("export async function completeCleaningTask"), service.indexOf("export async function saveCleaningTaskNote"));
  const roomNoteWrite = completion.slice(completion.indexOf("await tx.roomNote.upsert"), completion.indexOf("await tx.cleaningPhoto.updateMany"));
  assert.doesNotMatch(roomNoteWrite, /ROOM_NOTE_COMPLETED|status:\s*"COMPLETED"/);
  assert.match(roomNoteWrite, /sourceType: "CLEANING"[\s\S]*status: "OPEN"/);
});

test("미처리 메모 경고는 청소 완료를 차단하지 않고 확인과 계속 진행을 제공한다", () => {
  const workflow = read("src/features/cleaning/components/cleaning-workflow-dialog.tsx");
  assert.match(workflow, /openRoomNotesWarning/);
  assert.match(workflow, /reviewRoomNotes/);
  assert.match(workflow, /completeWithOpenNotes/);
  assert.match(workflow, /const valid = identityValid && \(mode !== "complete" \|\| photoState\.readyForCompletion\)/);
  assert.doesNotMatch(workflow, /valid =[^;]*openRoomNoteCount/);
});

test("청소 메모 상세는 작성자·작성일·사진과 완료 버튼을 제공하고 삭제는 제공하지 않는다", () => {
  const dialog = read("src/features/cleaning/components/cleaning-room-notes-dialog.tsx");
  assert.match(dialog, /authorAndDate/);
  assert.match(dialog, /CleaningPhotoUploader[\s\S]*readOnly/);
  assert.match(dialog, /canComplete &&/);
  assert.doesNotMatch(dialog, /deleteRoomNoteAction|ROOM_NOTE_DELETE/);
});

test("모바일 카드에서 객실 메모 count와 사진 수를 상세 안에 숨기지 않고 표시한다", () => {
  const summary = read("src/features/cleaning/components/cleaning-room-note-summary.tsx");
  const card = read("src/features/cleaning/components/cleaning-task-card.tsx");
  assert.match(summary, /data-cleaning-room-notes/);
  assert.match(summary, /Badge/);
  assert.match(summary, /note\.photoCount > 0/);
  assert.match(card, /CleaningRoomNoteSummary notes=\{task\.openRoomNotes\}/);
});
