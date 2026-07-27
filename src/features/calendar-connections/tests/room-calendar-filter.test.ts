import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoomCalendarSelection } from "../lib/normalize-room-calendar-filters";

const rooms = [
  { id: "room-a", name: "206호", propertyId: "property-a", propertyName: "선사인", isActive: true, propertyIsActive: true },
  { id: "room-b", name: "101호", propertyId: "property-b", propertyName: "다른 숙소", isActive: true, propertyIsActive: true },
];

test("선택한 숙소와 그 숙소에 속한 객실만 필터로 유지한다", () => {
  assert.deepEqual(normalizeRoomCalendarSelection(rooms, "property-a", "room-a"), { propertyId: "property-a", roomId: "room-a" });
  assert.deepEqual(normalizeRoomCalendarSelection(rooms, "property-a", "room-b"), { propertyId: "property-a", roomId: undefined });
});

test("모든 숙소와 접근 불가능한 ID를 안전하게 처리한다", () => {
  assert.deepEqual(normalizeRoomCalendarSelection(rooms, undefined, "room-b"), { propertyId: undefined, roomId: "room-b" });
  assert.deepEqual(normalizeRoomCalendarSelection(rooms, "unknown", "unknown"), { propertyId: undefined, roomId: undefined });
});
