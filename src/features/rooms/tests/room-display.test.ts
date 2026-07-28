import test from "node:test";
import assert from "node:assert/strict";
import { formatPropertyRoomDisplayName, formatRoomDisplayLabel, formatRoomDisplayName, formatRoomNumber, UNNAMED_ROOM_LABEL } from "../room-display";

test("객실 표시명은 code가 있어도 name만 반환한다", () => {
  assert.equal(formatRoomDisplayName({ name: "303호", code: "303" }), "303호");
  assert.equal(formatRoomDisplayName({ name: "701호", code: "701" }), "701호");
  assert.equal(formatRoomDisplayName({ name: "801호", code: "801" }), "801호");
});

test("객실 표시명 앞뒤 공백을 제거한다", () => {
  assert.equal(formatRoomDisplayName({ name: " 303호 " }), "303호");
});

test("객실명이 비어 있으면 내부 code를 노출하지 않는다", () => {
  assert.equal(formatRoomDisplayName({ name: "   ", code: "303" }), UNNAMED_ROOM_LABEL);
});

test("숙소와 객실을 조합해도 객실 code는 포함하지 않는다", () => {
  assert.equal(
    formatPropertyRoomDisplayName({ name: " 세레니테 " }, { name: "303호", code: "303" }),
    "세레니테 · 303호",
  );
});

test("모바일 타임라인 객실 라벨은 숙소명과 한국어 호실을 한 줄로 조합한다", () => {
  assert.equal(formatRoomDisplayLabel({ propertyName: " 가르데니아 ", roomName: "101" }), "가르데니아 101호");
  assert.equal(formatRoomDisplayLabel({ propertyName: "가르데니아", roomName: "101호" }), "가르데니아 101호");
  assert.equal(formatRoomDisplayLabel({ propertyName: "", roomName: "", roomNumber: "201" }), "201호");
});

test("모바일 타임라인 객실 라벨은 일본어 locale에서 号室 접미사를 사용한다", () => {
  assert.equal(formatRoomDisplayLabel({ propertyName: "ガルデニア", roomName: "101호" }, "ja-JP"), "ガルデニア 101号室");
  assert.equal(formatRoomNumber("101号室", "ko-KR"), "101호");
});
