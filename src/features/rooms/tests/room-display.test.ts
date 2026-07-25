import test from "node:test";
import assert from "node:assert/strict";
import { formatPropertyRoomDisplayName, formatRoomDisplayName, UNNAMED_ROOM_LABEL } from "../room-display";

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
