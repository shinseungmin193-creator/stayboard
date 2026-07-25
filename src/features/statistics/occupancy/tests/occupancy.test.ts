import test from "node:test";
import assert from "node:assert/strict";
import { calculateOccupancyMetrics, type OccupancyPeriod, type OccupancyRoom } from "../domain/occupancy";
import { resolveOccupancyPeriod } from "../domain/occupancy-period";

const day = (value: string) => new Date(`${value}T00:00:00+09:00`);
const period: OccupancyPeriod = { start: day("2026-07-01"), endExclusive: day("2026-07-11"), startLabel: "2026-07-01", endLabel: "2026-07-10", nightCount: 10 };
const room = (overrides: Partial<OccupancyRoom> = {}): OccupancyRoom => ({ id: "303", propertyId: "p1", propertyName: "세레니테", name: "303호", sortOrder: 1, activeConflictCount: 0, reservations: [], ...overrides });
const reservation = (startDate: string, endDate: string, status: "CONFIRMED" | "CANCELLED" | "BLOCKED" = "CONFIRMED") => ({ startDate: day(startDate), endDate: day(endDate), status });

test("예약이 없으면 총 점유율은 0%다", () => assert.equal(calculateOccupancyMetrics([room()], period).occupancyPercent, 0));
test("한 객실이 기간 전체 예약이면 100%다", () => assert.equal(calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-11")] })], period).occupancyPercent, 100));
test("체크아웃 날짜는 점유 숙박일에서 제외한다", () => assert.equal(calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-02")] })], period).occupiedNights, 1));
test("기간 일부만 겹치는 예약의 겹친 숙박일만 계산한다", () => assert.equal(calculateOccupancyMetrics([room({ reservations: [reservation("2026-06-29", "2026-07-03"), reservation("2026-07-09", "2026-07-13")] })], period).occupiedNights, 4));
test("취소 예약을 제외한다", () => assert.equal(calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-05", "CANCELLED")] })], period).occupiedNights, 0));
test("BLOCKED는 일반 점유 숙박에서 제외한다", () => assert.equal(calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-04", "BLOCKED")] })], period).occupiedNights, 0));
test("BLOCKED 날짜는 판매 가능 일수에서 제외한다", () => { const result = calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-04", "BLOCKED")] })], period); assert.equal(result.blockedNights, 3); assert.equal(result.sellableNights, 7); });
test("동일 객실의 중복 예약 날짜는 한 번만 계산한다", () => assert.equal(calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-05"), reservation("2026-07-03", "2026-07-07")] })], period).occupiedNights, 6));
test("충돌 예약으로 점유율이 100%를 초과하지 않는다", () => assert.equal(calculateOccupancyMetrics([room({ reservations: [reservation("2026-06-01", "2026-08-01"), reservation("2026-07-01", "2026-07-11")] })], period).occupancyPercent, 100));
test("여러 객실 총 점유율을 판매 가능 숙박 수 기준으로 계산한다", () => { const result = calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-06")] }), room({ id: "701", name: "701호", reservations: [reservation("2026-07-01", "2026-07-11")] })], period); assert.equal(result.occupiedNights, 15); assert.equal(result.sellableNights, 20); assert.equal(result.occupancyPercent, 75); });
test("판매 가능 일수가 0이면 점유율은 0%다", () => { const result = calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-11", "BLOCKED")] })], period); assert.equal(result.sellableNights, 0); assert.equal(result.occupancyPercent, 0); });
test("잘못된 예약 날짜를 제외한다", () => assert.equal(calculateOccupancyMetrics([room({ reservations: [{ status: "CONFIRMED", startDate: new Date(Number.NaN), endDate: day("2026-07-03") }, reservation("2026-07-04", "2026-07-03")] })], period).occupiedNights, 0));
test("객실당 점유율이 높은 순, 기존 자연 정렬 순으로 정렬된다", () => { const rooms = [room({ id: "801", name: "801호", sortOrder: 2, reservations: [reservation("2026-07-01", "2026-07-03")] }), room({ id: "701", name: "701호", sortOrder: 2, reservations: [reservation("2026-07-01", "2026-07-03")] }), room({ id: "303", name: "303호", sortOrder: 1, reservations: [reservation("2026-07-01", "2026-07-06")] })]; assert.deepEqual(calculateOccupancyMetrics(rooms, period).rooms.map((item) => item.roomId), ["303", "701", "801"]); });
test("숙소 필터 후 전달된 객실만 총계에 포함한다", () => { const rooms = [room(), room({ id: "other", propertyId: "p2", propertyName: "다른 숙소" })].filter((item) => item.propertyId === "p1"); assert.equal(calculateOccupancyMetrics(rooms, period).roomCount, 1); });
test("예약과 BLOCKED가 겹치면 예약을 우선하고 이상 상태를 표시한다", () => { const result = calculateOccupancyMetrics([room({ reservations: [reservation("2026-07-01", "2026-07-04"), reservation("2026-07-02", "2026-07-05", "BLOCKED")] })], period); assert.equal(result.occupiedNights, 3); assert.equal(result.blockedNights, 1); assert.equal(result.hasOverlapAnomaly, true); });
test("기간 Search Params를 다음 달 범위로 파싱한다", () => { const result = resolveOccupancyPeriod({ period: "next-month" }, day("2026-07-24")); assert.equal(result.key, "next-month"); assert.equal(result.period.startLabel, "2026-08-01"); assert.equal(result.period.endLabel, "2026-08-31"); });
test("유효한 사용자 지정 기간을 종료일 포함 범위로 파싱한다", () => { const result = resolveOccupancyPeriod({ from: "2026-07-03", to: "2026-07-05" }, day("2026-07-24")); assert.equal(result.key, "custom"); assert.equal(result.period.nightCount, 3); });
test("잘못된 사용자 지정 날짜는 이번 달로 fallback한다", () => { const result = resolveOccupancyPeriod({ from: "invalid", to: "2026-07-01" }, day("2026-07-24")); assert.equal(result.key, "this-month"); });
