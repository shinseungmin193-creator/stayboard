import test from "node:test";
import assert from "node:assert/strict";
import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";
import { ROOM_OPERATION_POLICY, shouldMarkCleaningRequired } from "../room-operational-status";
import { updateRoomOperationalStatus } from "../update-room-operational-status";
import { roomOperationalStatusSchema } from "../room.schemas";

const now = new Date("2026-07-24T12:00:00+09:00");
function dependencies(exists = true) { let saved: RoomOperationalStatus | null = null; return { get saved() { return saved; }, findRoom: async () => exists ? { id: "room-1" } : null, updateStatus: async (id: string, operationalStatus: RoomOperationalStatus, updatedAt: Date) => { saved = operationalStatus; return { id, operationalStatus, operationalStatusUpdatedAt: updatedAt }; } }; }
for (const [from, to] of [["NONE", "CLEANING_REQUIRED"], ["NONE", "INSPECTION_REQUIRED"], ["CLEANING_REQUIRED", "NONE"], ["INSPECTION_REQUIRED", "NONE"]] as const) test(`${from} → ${to} 운영 상태를 변경한다`, async () => { const deps = dependencies(); const result = await updateRoomOperationalStatus({ roomId: "room-1", operationalStatus: to }, deps, now); assert.equal(result.success, true); assert.equal(deps.saved, to); if (result.success) assert.equal(result.updatedAt, now.toISOString()); });
test("존재하지 않는 객실은 명확한 오류를 반환한다", async () => { const result = await updateRoomOperationalStatus({ roomId: "missing", operationalStatus: "NONE" }, dependencies(false), now); assert.deepEqual(result, { success: false, code: "ROOM_NOT_FOUND", message: "객실을 찾을 수 없습니다." }); });
test("운영 상태 변경은 전달받은 상태와 시각만 repository에 전달한다", async () => { const deps = dependencies(); await updateRoomOperationalStatus({ roomId: "room-1", operationalStatus: "INSPECTION_REQUIRED" }, deps, now); assert.equal(deps.saved, "INSPECTION_REQUIRED"); });
test("체크아웃 청소 자동 설정 정책은 기본 비활성이다", () => { assert.equal(ROOM_OPERATION_POLICY.autoMarkCleaningRequired, false); assert.equal(shouldMarkCleaningRequired({ operationalStatus: "NONE", todayStart: new Date("2026-07-24T00:00:00+09:00"), todayEnd: new Date("2026-07-25T00:00:00+09:00"), reservations: [{ status: "CONFIRMED", startDate: new Date("2026-07-23T00:00:00+09:00"), endDate: new Date("2026-07-24T12:00:00+09:00") }] }), false); });
test("허용되지 않은 운영 상태를 차단한다", () => assert.equal(roomOperationalStatusSchema.safeParse({ roomId: "room-1", operationalStatus: "RESERVED" }).success, false));
