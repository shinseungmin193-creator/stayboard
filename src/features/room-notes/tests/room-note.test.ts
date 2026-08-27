import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeRoomNoteSelection, parseRoomNoteStatusFilter, serializeRoomNoteStatusFilter } from "../domain/room-note";

const read = (path: string) => readFileSync(path, "utf8");

test("객실 메모 상태 필터는 기본 OPEN과 completed/all 쿼리를 구분한다", () => {
  assert.equal(parseRoomNoteStatusFilter(undefined), "OPEN");
  assert.equal(parseRoomNoteStatusFilter("open"), "OPEN");
  assert.equal(parseRoomNoteStatusFilter("completed"), "COMPLETED");
  assert.equal(parseRoomNoteStatusFilter("all"), null);
  assert.equal(serializeRoomNoteStatusFilter("COMPLETED"), "completed");
  assert.equal(serializeRoomNoteStatusFilter(null), "all");
});

test("숙소와 객실 필터는 서로 일치하는 회사 범위 옵션만 유지한다", () => {
  const rooms = [{ id: "room-a", propertyId: "property-a" }, { id: "room-b", propertyId: "property-b" }];
  assert.deepEqual(normalizeRoomNoteSelection(rooms, "property-a", "room-a"), { propertyId: "property-a", roomId: "room-a" });
  assert.deepEqual(normalizeRoomNoteSelection(rooms, "property-a", "room-b"), { propertyId: "property-a", roomId: null });
  assert.deepEqual(normalizeRoomNoteSelection(rooms, "outside", "room-a"), { propertyId: null, roomId: "room-a" });
});

test("목록 조회는 STAFF 객실 배정이 아닌 회사 범위만 적용한다", () => {
  const repository = read("src/features/room-notes/server/room-note.repository.ts");
  assert.match(repository, /companyScopeIds\(context\)/);
  assert.doesNotMatch(repository, /roomScopeWhere/);
  assert.match(repository, /companyId: \{ in: \[\.\.\.companyIds\] \}/);
});

test("직접 메모 생성은 기존 STAFF 객실 배정 범위를 계속 검증한다", () => {
  const repository = read("src/features/room-notes/server/room-note.repository.ts");
  const service = read("src/features/room-notes/server/room-note.service.ts");
  const dialog = read("src/features/room-notes/components/room-note-create-dialog.tsx");
  assert.match(repository, /canCreate: canAccessRoom\(context, room\)/);
  assert.match(service, /!canAccessRoom\(context, room\)/);
  assert.match(dialog, /room\.canCreate/);
});

test("수동 메모와 청소 메모는 단일 RoomNote 쿼리와 DB 페이지네이션을 사용한다", () => {
  const repository = read("src/features/room-notes/server/room-note.repository.ts");
  assert.match(repository, /prisma\.roomNote\.count/);
  assert.match(repository, /prisma\.roomNote\.findMany/);
  assert.doesNotMatch(repository, /prisma\.cleaningTask\.findMany/);
  assert.match(repository, /skip: \(page - 1\) \* ROOM_NOTE_PAGE_SIZE/);
  assert.match(repository, /filters\.status \? \{ status: filters\.status \}/);
});

test("청소 메모는 원본 CleaningTask 내용과 읽기 전용 사진을 관계로 조회한다", () => {
  const repository = read("src/features/room-notes/server/room-note.repository.ts");
  assert.match(repository, /cleaningTask: \{/);
  assert.match(repository, /storageKey: \{ not: null \}, deletedAt: null/);
  assert.match(repository, /note\.sourceType === "CLEANING" \? task\?\.note : note\.content/);
});

test("완료와 재오픈은 처리자 정보를 기록·해제하고 각각 AuditLog를 남긴다", () => {
  const service = read("src/features/room-notes/server/room-note.service.ts");
  assert.match(service, /completedAt: new Date\(\)/);
  assert.match(service, /completedByUserId: context\.userId/);
  assert.match(service, /completedByName: context\.name\?\.trim\(\) \|\| "-"/);
  assert.match(service, /completedAt: null[\s\S]*completedByUserId: null[\s\S]*completedByName: null/);
  assert.match(service, /ROOM_NOTE_COMPLETED/);
  assert.match(service, /ROOM_NOTE_REOPENED/);
});

test("상태 변경 액션은 클라이언트 입력을 믿지 않고 서버 권한과 회사 범위를 재검증한다", () => {
  const actions = read("src/features/room-notes/room-note.actions.ts");
  const access = read("src/features/room-notes/server/room-note-access.ts");
  assert.match(actions, /requireRoomNoteAccess\(parsed\.data\.id, PERMISSIONS\.ROOM_NOTE_COMPLETE\)/);
  assert.match(access, /requirePermission\(permission\)/);
  assert.match(access, /canAccessCompany\(context, note\.companyId\)/);
});

test("삭제 액션은 ROOM_NOTE_DELETE 권한을 서버에서 검사한다", () => {
  const actions = read("src/features/room-notes/room-note.actions.ts");
  assert.match(actions, /requireRoomNoteAccess\(parsed\.data\.id, PERMISSIONS\.ROOM_NOTE_DELETE\)/);
  assert.match(actions, /deleteRoomNote\(context, parsed\.data\.id\)/);
});

test("객실 메모 삭제는 RoomNote와 감사 기록만 변경하고 청소 원본을 삭제하지 않는다", () => {
  const service = read("src/features/room-notes/server/room-note.service.ts");
  const deletion = service.slice(service.indexOf("export async function deleteRoomNote"));
  assert.match(deletion, /tx\.roomNote\.delete/);
  assert.match(deletion, /ROOM_NOTE_DELETED/);
  assert.doesNotMatch(deletion, /tx\.cleaningTask\.(delete|update)/);
  assert.doesNotMatch(deletion, /tx\.cleaningTaskLog\.(delete|update)/);
  assert.doesNotMatch(deletion, /tx\.cleaningPhoto\.(delete|update)/);
});

test("청소 완료는 메모 메타데이터를 멱등 생성하고 RoomNote 상태를 덮어쓰지 않는다", () => {
  const service = read("src/features/cleaning/server/cleaning-task.service.ts");
  const completion = service.slice(service.indexOf("export async function completeCleaningTask"), service.indexOf("export async function saveCleaningTaskNote"));
  assert.match(completion, /tx\.roomNote\.upsert/);
  assert.match(completion, /where: \{ cleaningTaskId: task\.id \}/);
  assert.match(completion, /sourceType: "CLEANING"/);
  assert.match(completion, /status: "OPEN"/);
  const updateBlock = completion.slice(completion.indexOf("update: {"));
  assert.doesNotMatch(updateBlock, /status:/);
});

test("마이그레이션은 기존 완료 청소 메모를 보강하고 원본 소유권 제약을 둔다", () => {
  const migration = read("prisma/migrations/20260826150000_add_room_note_status_and_cleaning_source/migration.sql");
  assert.match(migration, /INSERT INTO "RoomNote"/);
  assert.match(migration, /task\."status" = 'COMPLETED'/);
  assert.match(migration, /ON CONFLICT \("cleaningTaskId"\) DO NOTHING/);
  assert.match(migration, /RoomNote_source_shape_check/);
  assert.match(migration, /REFERENCES "CleaningTask"\("id"\) ON DELETE CASCADE/);
});

test("기본 객실 메모 페이지는 OPEN 상태를 사용하고 completed/all 쿼리를 유지한다", () => {
  const page = read("src/app/room-notes/page.tsx");
  const filter = read("src/features/room-notes/components/room-note-filter-bar.tsx");
  assert.match(page, /status: parseRoomNoteStatusFilter/);
  assert.match(page, /filters\.status !== "OPEN"/);
  assert.match(filter, /value="open"/);
  assert.match(filter, /value="completed"/);
  assert.match(filter, /value="all"/);
});

test("PC·모바일 목록과 상세에서 상태 변경, 권한별 삭제, 확인창을 제공한다", () => {
  const list = read("src/features/room-notes/components/room-note-list.tsx");
  assert.match(list, /hidden overflow-hidden py-0 md:block/);
  assert.match(list, /space-y-2 md:hidden/);
  assert.match(list, /changeRoomNoteStatusAction/);
  assert.match(list, /canDelete &&/);
  assert.match(list, /role="alertdialog"/);
  assert.match(list, /CleaningPhotoUploader[\s\S]*readOnly/);
  assert.match(list, /completedByName/);
  assert.match(list, /completedAt/);
});

test("객실 메모 스키마는 상태·완료 처리자·청소 원본 관계를 명시한다", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /enum RoomNoteStatus \{[\s\S]*OPEN[\s\S]*COMPLETED/);
  assert.match(schema, /completedByUserId\s+String\?/);
  assert.match(schema, /cleaningTaskId\s+String\?\s+@unique/);
});
