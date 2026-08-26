import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { mergeRoomNotePage, normalizeRoomNoteSelection } from "../domain/room-note";
import type { RoomNoteViewModel } from "../room-note.types";

function note(input: Partial<RoomNoteViewModel> & Pick<RoomNoteViewModel, "id" | "sourceType" | "createdAt">): RoomNoteViewModel {
  return {
    sourceId: input.id.split(":")[1] ?? input.id,
    propertyId: "property-a",
    propertyName: "로이야루",
    propertyTimeZone: "Asia/Tokyo",
    roomId: "room-a",
    roomName: "301호",
    content: "메모",
    authorName: "홍길동",
    cleaningTaskId: input.sourceType === "CLEANING" ? "task-a" : null,
    cleaningDate: input.sourceType === "CLEANING" ? "2026-08-26" : null,
    photoCount: 0,
    photos: [],
    ...input,
  };
}

test("청소 완료 메모와 직접 작성 메모를 하나의 목록으로 합친다", () => {
  const cleaning = note({ id: "CLEANING:task-a", sourceType: "CLEANING", createdAt: "2026-08-26T01:00:00.000Z" });
  const manual = note({ id: "MANUAL:note-a", sourceType: "MANUAL", createdAt: "2026-08-26T02:00:00.000Z" });
  assert.deepEqual(mergeRoomNotePage([manual], [cleaning], 1).map((item) => item.sourceType), ["MANUAL", "CLEANING"]);
});

test("같은 CleaningTask 소스는 재처리되어도 한 번만 표시한다", () => {
  const cleaning = note({ id: "CLEANING:task-a", sourceType: "CLEANING", createdAt: "2026-08-26T01:00:00.000Z" });
  assert.equal(mergeRoomNotePage([], [cleaning, { ...cleaning }], 1).length, 1);
});

test("사진 있는 청소 메모의 사진 정보가 통합 목록에 유지된다", () => {
  const cleaning = note({
    id: "CLEANING:task-photo",
    sourceType: "CLEANING",
    createdAt: "2026-08-26T01:00:00.000Z",
    photoCount: 1,
    photos: [{ id: "photo-a", url: "/api/cleaning/photos/photo-a", mimeType: "image/jpeg", size: 100, originalName: "room.jpg", createdAt: "2026-08-26T01:00:00.000Z", deleteAfter: null, deletedAt: null }],
  });
  const [result] = mergeRoomNotePage([], [cleaning], 1);
  assert.equal(result.photoCount, 1);
  assert.equal(result.photos[0]?.id, "photo-a");
});

test("작성일 최신순과 동일 시각 id 내림차순으로 정렬한다", () => {
  const older = note({ id: "MANUAL:a", sourceType: "MANUAL", createdAt: "2026-08-25T01:00:00.000Z" });
  const sameA = note({ id: "MANUAL:b", sourceType: "MANUAL", createdAt: "2026-08-26T01:00:00.000Z" });
  const sameB = note({ id: "MANUAL:c", sourceType: "MANUAL", createdAt: "2026-08-26T01:00:00.000Z" });
  assert.deepEqual(mergeRoomNotePage([older, sameA, sameB], [], 1).map((item) => item.id), ["MANUAL:c", "MANUAL:b", "MANUAL:a"]);
});

test("숙소와 객실 필터는 서로 일치하는 접근 가능 옵션만 유지한다", () => {
  const rooms = [{ id: "room-a", propertyId: "property-a" }, { id: "room-b", propertyId: "property-b" }];
  assert.deepEqual(normalizeRoomNoteSelection(rooms, "property-a", "room-a"), { propertyId: "property-a", roomId: "room-a" });
  assert.deepEqual(normalizeRoomNoteSelection(rooms, "property-a", "room-b"), { propertyId: "property-a", roomId: null });
  assert.deepEqual(normalizeRoomNoteSelection(rooms, "outside", "room-a"), { propertyId: null, roomId: "room-a" });
});

test("저장소는 STAFF room scope, 완료 청소 메모, 사진 관계를 같은 조회에 적용한다", () => {
  const repository = readFileSync("src/features/room-notes/server/room-note.repository.ts", "utf8");
  const service = readFileSync("src/features/room-notes/server/room-note.service.ts", "utf8");
  assert.match(repository, /roomScopeWhere\(context\.scope\)/);
  assert.match(repository, /status: "COMPLETED"/);
  assert.match(repository, /action: "NOTE_ADDED"/);
  assert.match(repository, /storageKey: \{ not: null \}, deletedAt: null/);
  assert.match(service, /canAccessRoom\(context, room\)/);
  assert.match(service, /tx\.roomNote\.create/);
  assert.doesNotMatch(service, /CleaningTask|cleaningTask/);
});

test("목록은 PC 테이블과 모바일 카드, 읽기 전용 청소 사진 상세를 함께 제공한다", () => {
  const list = readFileSync("src/features/room-notes/components/room-note-list.tsx", "utf8");
  assert.match(list, /hidden overflow-hidden py-0 md:block/);
  assert.match(list, /space-y-2 md:hidden/);
  assert.match(list, /CleaningPhotoUploader[\s\S]*readOnly/);
  assert.match(list, /openFromKeyboard/);
});
