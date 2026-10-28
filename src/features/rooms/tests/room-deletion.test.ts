import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isRoomDeletionConfirmationValid } from "../domain/room-deletion";

const repository = readFileSync("src/features/rooms/room.repository.ts", "utf8");
const relatedDeletion = readFileSync("src/features/rooms/room-related-data-deletion.ts", "utf8");
const runtime = readFileSync("src/features/rooms/room-deletion-runtime.ts", "utf8");
const service = readFileSync("src/features/rooms/room-deletion.service.ts", "utf8");
const actions = readFileSync("src/features/rooms/room.actions.ts", "utf8");
const dialog = readFileSync("src/features/rooms/components/room-delete-dialog.tsx", "utf8");
const list = readFileSync("src/features/rooms/components/room-list.tsx", "utf8");

test("객실명 확인은 실제 표시 이름과 일치해야 한다", () => {
  assert.equal(isRoomDeletionConfirmationValid(" 301 ", "301"), true);
  assert.equal(isRoomDeletionConfirmationValid("301호", "301"), false);
  assert.equal(isRoomDeletionConfirmationValid("삭제", "301"), false);
});

test("영향 조회와 삭제는 서버에서 ROOM_MANAGE와 객실 접근 범위를 검증한다", () => {
  const impactStart = actions.indexOf("export async function getRoomDeleteImpactAction");
  const deleteStart = actions.indexOf("export async function deleteRoomAction");
  assert.ok(impactStart >= 0 && deleteStart > impactStart);
  assert.match(actions.slice(impactStart, deleteStart), /requireRoomAccess\(parsed\.data\.roomId, PERMISSIONS\.ROOM_MANAGE\)/);
  assert.match(actions.slice(deleteStart), /requireRoomAccess\(parsed\.data\.roomId, PERMISSIONS\.ROOM_MANAGE\)/);
  assert.doesNotMatch(actions.slice(deleteStart), /companyId:\s*input|userId:\s*input|role:\s*input/);
});

test("객실 종속 데이터는 공통 삭제 계층에서 의존성 순서로 제거한다", () => {
  assert.match(repository, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(repository, /isolationLevel:\s*Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(repository, /deleteRoomRelatedData\(tx/);
  assert.match(repository, /where:\s*\{ id: currentTarget\.id, propertyId: currentTarget\.propertyId \}/);

  const notes = relatedDeletion.indexOf("tx.roomNote.deleteMany");
  const logs = relatedDeletion.indexOf("tx.cleaningTaskLog.deleteMany");
  const photos = relatedDeletion.indexOf("tx.cleaningPhoto.deleteMany");
  const tasks = relatedDeletion.indexOf("tx.cleaningTask.deleteMany");
  const conflicts = relatedDeletion.indexOf("tx.reservationConflict.deleteMany");
  const reservations = relatedDeletion.indexOf("tx.reservation.deleteMany");
  const syncLogs = relatedDeletion.indexOf("tx.syncLog.deleteMany");
  const sources = relatedDeletion.indexOf("tx.calendarSource.deleteMany");
  assert.ok(notes >= 0 && logs > notes && photos > logs && tasks > photos);
  assert.ok(conflicts > tasks && reservations > conflicts && syncLogs > reservations && sources > syncLogs);
});

test("다른 객실을 건드리지 않고 동시 작업 잠금·사진 파일 정리·감사 로그를 적용한다", () => {
  assert.match(relatedDeletion, /where:\s*\{ roomId: \{ in: \[\.\.\.input\.roomIds\] \} \}/);
  assert.match(runtime, /calendarSourceIds\.map\(calendarSourceSyncLockKey\)/);
  assert.match(runtime, /roomIds\.map\(calendarRoomSyncLockKey\)/);
  assert.match(runtime, /roomListingIds\.map\(reviewSyncLockKey\)/);
  assert.match(service, /deleteRoomTransaction[\s\S]*deleteCleaningPhotoFiles\(deleted\.photoStorageKeys\)/);
  assert.match(repository, /action:\s*"ROOM_DELETED"/);
});

test("객실 목록 삭제 UI는 영향과 비가역 경고를 보여주고 객실명 확인 후 실행한다", () => {
  assert.match(list, /<RoomDeleteDialog room=\{room\}/);
  assert.match(dialog, /getRoomDeleteImpactAction\(room\.id\)/);
  assert.match(dialog, /isRoomDeletionConfirmationValid\(confirmationText, room\.name\)/);
  assert.match(dialog, /disabled=\{!confirmationValid \|\| !impact \|\| impactPending \|\| deletePending\}/);
  assert.match(dialog, /warnings\.propertyPreserved/);
  assert.match(dialog, /impact\.cleaningPhotos/);
  assert.match(dialog, /impact\.reviews/);
});

