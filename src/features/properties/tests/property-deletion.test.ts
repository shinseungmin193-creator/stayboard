import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isPropertyDeletionConfirmationValid } from "../domain/property-deletion";

const repository = readFileSync("src/features/properties/property.repository.ts", "utf8");
const service = readFileSync("src/features/properties/property-deletion.service.ts", "utf8");
const relatedDeletion = readFileSync("src/features/rooms/room-related-data-deletion.ts", "utf8");
const deletionRuntime = readFileSync("src/features/rooms/room-deletion-runtime.ts", "utf8");
const actions = readFileSync("src/features/properties/property.actions.ts", "utf8");
const dialog = readFileSync("src/features/properties/components/property-delete-dialog.tsx", "utf8");
const list = readFileSync("src/features/properties/components/property-list.tsx", "utf8");

test("건물명 확인은 앞뒤 공백만 허용하고 실제 이름이 일치해야 한다", () => {
  assert.equal(isPropertyDeletionConfirmationValid(" 그란 ", "그란"), true);
  assert.equal(isPropertyDeletionConfirmationValid("그란  ", "그란"), true);
  assert.equal(isPropertyDeletionConfirmationValid("그란1", "그란"), false);
  assert.equal(isPropertyDeletionConfirmationValid("삭제", "그란"), false);
});

test("삭제와 영향 조회 모두 서버에서 PROPERTY_MANAGE 및 property scope를 검증한다", () => {
  const impactStart = actions.indexOf("export async function getPropertyDeleteImpactAction");
  const deleteStart = actions.indexOf("export async function deletePropertyAction");
  assert.ok(impactStart >= 0 && deleteStart > impactStart);
  assert.match(actions.slice(impactStart, deleteStart), /requirePropertyAccess\(parsed\.data\.propertyId, PERMISSIONS\.PROPERTY_MANAGE\)/);
  assert.match(actions.slice(deleteStart), /requirePropertyAccess\(parsed\.data\.propertyId, PERMISSIONS\.PROPERTY_MANAGE\)/);
  assert.doesNotMatch(actions.slice(deleteStart), /companyId:\s*input|userId:\s*input|role:\s*input/);
});

test("관련 레코드는 한 트랜잭션에서 의존성 순서로 삭제되고 다른 건물은 범위에 포함하지 않는다", () => {
  assert.match(repository, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(repository, /isolationLevel:\s*Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(repository, /where:\s*\{ id: currentTarget\.id, companyId: currentTarget\.companyId \}/);
  assert.match(repository, /room\.deleteMany\(\{ where: \{ id: \{ in: currentTarget\.roomIds \}, propertyId: currentTarget\.id \}/);

  assert.match(repository, /deleteRoomRelatedData\(tx/);
  const roomNotes = relatedDeletion.indexOf("tx.roomNote.deleteMany");
  const taskLogs = relatedDeletion.indexOf("tx.cleaningTaskLog.deleteMany");
  const photos = relatedDeletion.indexOf("tx.cleaningPhoto.deleteMany");
  const tasks = relatedDeletion.indexOf("tx.cleaningTask.deleteMany");
  const conflicts = relatedDeletion.indexOf("tx.reservationConflict.deleteMany");
  const reservations = relatedDeletion.indexOf("tx.reservation.deleteMany");
  const syncLogs = relatedDeletion.indexOf("tx.syncLog.deleteMany");
  const sources = relatedDeletion.indexOf("tx.calendarSource.deleteMany");
  const rooms = repository.indexOf("tx.room.deleteMany");
  const property = repository.indexOf("tx.property.deleteMany");
  assert.ok(roomNotes >= 0 && taskLogs > roomNotes && photos > taskLogs && tasks > photos);
  assert.ok(conflicts > tasks && reservations > conflicts && syncLogs > reservations);
  assert.ok(sources > syncLogs && rooms > sources && property > rooms);
});

test("캘린더·리뷰 동시 작업을 잠그고 DB 삭제 뒤 실제 청소 사진 파일도 정리한다", () => {
  assert.match(deletionRuntime, /calendarSourceIds\.map\(calendarSourceSyncLockKey\)/);
  assert.match(deletionRuntime, /roomIds\.map\(calendarRoomSyncLockKey\)/);
  assert.match(deletionRuntime, /roomListingIds\.map\(reviewSyncLockKey\)/);
  assert.match(service, /deletePropertyTransaction[\s\S]*deleteCleaningPhotoFiles\(deleted\.photoStorageKeys\)/);
  assert.match(service, /PROPERTY_PHOTO_FILE_CLEANUP_FAILED/);
  assert.match(repository, /action:\s*"PROPERTY_DELETED"/);
});

test("삭제 UI는 영향 확인, 건물명 확인, 비가역 경고 후에만 실행한다", () => {
  assert.match(list, /<PropertyDeleteDialog property=\{property\}/);
  assert.match(dialog, /getPropertyDeleteImpactAction\(property\.id\)/);
  assert.match(dialog, /isPropertyDeletionConfirmationValid\(confirmationText, property\.name\)/);
  assert.match(dialog, /disabled=\{!confirmationValid \|\| !impact \|\| impactPending \|\| deletePending\}/);
  assert.match(dialog, /warnings\.irreversible/);
  assert.match(dialog, /impact\.cleaningPhotos/);
  assert.match(dialog, /impact\.reviews/);
});

