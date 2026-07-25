import test from "node:test";
import assert from "node:assert/strict";
import { buildRoomOperationalSchedule, calculateRoomOverviewStatus, getReservationOperationalDay, getRoomOverviewGuestName, ROOM_OVERVIEW_STATUS_META, sortRoomOverviewCards, summarizeRoomOverview, type RoomOverviewCard, type RoomOverviewReservation } from "../domain/room-overview";
import { ROOM_OPERATIONAL_STATUS_META } from "../../rooms/room-operational-status";

const todayStart = new Date("2026-07-24T00:00:00+09:00");
const todayEnd = new Date("2026-07-25T00:00:00+09:00");
const reservation = (overrides: Partial<RoomOverviewReservation> = {}): RoomOverviewReservation => ({ id: "r1", guestName: null, provider: "AIRBNB", status: "CONFIRMED", startDate: new Date("2026-07-26T00:00:00+09:00"), endDate: new Date("2026-07-28T00:00:00+09:00"), ...overrides });
const status = (reservations: RoomOverviewReservation[], activeConflictCount = 0) => calculateRoomOverviewStatus({ reservations, activeConflictCount, todayStart, todayEnd });

test("예약이 없거나 미래 예약만 있으면 VACANT다", () => { assert.equal(status([]), "VACANT"); assert.equal(status([reservation()]), "VACANT"); });
test("오늘 체크인 상태를 계산한다", () => assert.equal(status([reservation({ startDate: todayStart })]), "CHECK_IN_TODAY"));
test("현재 투숙 상태를 계산한다", () => assert.equal(status([reservation({ startDate: new Date("2026-07-23T00:00:00+09:00"), endDate: new Date("2026-07-26T00:00:00+09:00") })]), "OCCUPIED"));
test("오늘 체크아웃 상태를 계산한다", () => assert.equal(status([reservation({ startDate: new Date("2026-07-22T00:00:00+09:00"), endDate: todayEnd })]), "CHECK_OUT_TODAY"));
test("오늘 종료 경계의 체크아웃을 모든 운영 계산에서 오늘로 분류한다", () => {
  const item = reservation({ startDate: new Date("2026-07-22T00:00:00+09:00"), endDate: todayEnd });
  const day = getReservationOperationalDay(item, todayStart, todayEnd);
  const schedule = buildRoomOperationalSchedule([item], todayStart, todayEnd, new Date("2026-08-01T00:00:00+09:00"));

  assert.equal(day.isTodayCheckOut, true);
  assert.deepEqual(schedule.todayCheckOuts.map(({ id }) => id), [item.id]);
  assert.deepEqual(schedule.nextCheckOuts, []);
});
test("BLOCKED만 있으면 VACANT다", () => assert.equal(status([reservation({ status: "BLOCKED", startDate: todayStart, endDate: todayEnd })]), "VACANT"));
test("ACTIVE 충돌이 모든 상태보다 우선한다", () => assert.equal(status([reservation({ startDate: todayStart })], 1), "CONFLICT"));
test("CANCELLED와 잘못된 날짜는 상태 계산에서 제외한다", () => { assert.equal(status([reservation({ status: "CANCELLED", startDate: todayStart })]), "VACANT"); assert.equal(status([reservation({ startDate: new Date(Number.NaN) })]), "VACANT"); });
test("여러 예약에서는 체크아웃 우선순위를 적용한다", () => assert.equal(status([reservation({ startDate: todayStart }), reservation({ id: "r2", startDate: new Date("2026-07-20T00:00:00+09:00"), endDate: todayEnd })]), "CHECK_OUT_TODAY"));
test("예약자 이름이 없으면 가짜 이름을 만들지 않는다", () => { assert.equal(getRoomOverviewGuestName(reservation({ guestName: "Kim" })), "Kim"); assert.equal(getRoomOverviewGuestName(reservation()), "예약자 정보 없음"); assert.equal(getRoomOverviewGuestName(reservation({ status: "BLOCKED" })), "예약자 정보 없음"); assert.equal(getRoomOverviewGuestName(reservation({ provider: "BOOKING" })), "예약자 정보 없음"); });

const card = (overrides: Partial<RoomOverviewCard>): RoomOverviewCard => ({ id: "1", propertyId: "p", propertyName: "세레니테", name: "객실", code: "801", sortOrder: 0, operationalStatus: "NONE", operationalStatusUpdatedAt: null, status: "VACANT", currentReservation: null, nextReservation: null, nextReservationLeadDays: null, reservationCount: 0, activeConflictCount: 0, providers: [], latestSync: null, syncStates: [], reservations: [], ...overrides });
test("객실은 숙소·sortOrder·객실 코드 순서로 정렬한다", () => { const result = sortRoomOverviewCards([card({ id: "801", code: "801", sortOrder: 2 }), card({ id: "303", code: "303", sortOrder: 1 }), card({ id: "701", code: "701", sortOrder: 2 })]); assert.deepEqual(result.map((item) => item.id), ["303", "701", "801"]); });
test("자동·수동 상태별 객실 수를 집계한다", () => { const result = summarizeRoomOverview([card({ status: "VACANT" }), card({ id: "2", status: "OCCUPIED", operationalStatus: "CLEANING_REQUIRED" }), card({ id: "3", status: "CONFLICT", operationalStatus: "INSPECTION_REQUIRED" })]); assert.equal(result.total, 3); assert.equal(result.statuses.VACANT, 1); assert.equal(result.statuses.CONFLICT, 1); assert.equal(result.operationalStatuses.CLEANING_REQUIRED, 1); });
test("CONFLICT는 오버부킹으로 표시한다", () => assert.equal(ROOM_OVERVIEW_STATUS_META.CONFLICT.label, "오버부킹"));
test("수동 운영 상태 표시 문자열을 구분한다", () => { assert.equal(ROOM_OPERATIONAL_STATUS_META.NONE.label, "상태 없음"); assert.equal(ROOM_OPERATIONAL_STATUS_META.CLEANING_REQUIRED.label, "청소 필요"); assert.equal(ROOM_OPERATIONAL_STATUS_META.INSPECTION_REQUIRED.label, "점검 필요"); });
test("오버부킹과 청소 필요 상태를 동시에 보존한다", () => { const value = card({ status: "CONFLICT", operationalStatus: "CLEANING_REQUIRED" }); assert.equal(value.status, "CONFLICT"); assert.equal(value.operationalStatus, "CLEANING_REQUIRED"); });
