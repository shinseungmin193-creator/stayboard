import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { reservationStatusesForFilter } from "../reservation.constants";
import { reservationDateHref, reservationDateRangeLabel, shiftReservationDateInput } from "../reservation-query";

test("체크인·체크아웃 기본 조회는 취소 예약을 제외한다", () => {
  assert.deepEqual(reservationStatusesForFilter(undefined, "checkIn"), ["CONFIRMED", "TENTATIVE"]);
  assert.deepEqual(reservationStatusesForFilter(undefined, "checkOut"), ["CONFIRMED", "TENTATIVE"]);
});

test("사용자가 CANCELLED 상태를 선택하면 취소 예약을 조회한다", () => {
  assert.deepEqual(reservationStatusesForFilter("CANCELLED", "checkOut"), ["CANCELLED"]);
});

test("날짜 이동은 날짜와 URL을 갱신하고 다른 필터를 유지한다", () => {
  const query = new URLSearchParams({ propertyId: "property-a", roomId: "room-a", provider: "AIRBNB", status: "CONFIRMED", dateField: "checkOut", from: "2026-07-25", to: "2026-07-25", page: "3" });
  const from = shiftReservationDateInput("2026-07-25", -1);
  const to = shiftReservationDateInput("2026-07-25", -1);
  const href = reservationDateHref(query, from, to);
  const result = new URL(href, "https://stayboard.test");
  assert.equal(result.searchParams.get("from"), "2026-07-24");
  assert.equal(result.searchParams.get("to"), "2026-07-24");
  assert.equal(result.searchParams.get("propertyId"), "property-a");
  assert.equal(result.searchParams.get("roomId"), "room-a");
  assert.equal(result.searchParams.get("provider"), "AIRBNB");
  assert.equal(result.searchParams.get("status"), "CONFIRMED");
  assert.equal(result.searchParams.get("dateField"), "checkOut");
  assert.equal(result.searchParams.has("page"), false);
});

test("현재 조회 날짜는 단일 날짜와 범위를 구분해 표시한다", () => {
  assert.equal(reservationDateRangeLabel("2026-07-26", "2026-07-26"), "2026년 7월 26일 (일)");
  assert.equal(reservationDateRangeLabel("2026-07-26", "2026-07-30"), "2026년 7월 26일 ~ 2026년 7월 30일");
});

test("Booking provider는 예약 목록·객실 현황·월간 캘린더 조회 대상에 포함된다", () => {
  for (const path of [
    "src/features/reservations/reservation.repository.ts",
    "src/features/room-overview/infrastructure/room-overview.repository.ts",
    "src/features/room-status/room-status.repository.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /CALENDAR_PROVIDER_TYPES/);
  }
  assert.match(readFileSync("src/providers/calendar/types.ts", "utf8"), /"BOOKING"/);
});
