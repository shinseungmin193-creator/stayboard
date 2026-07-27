import test from "node:test";
import assert from "node:assert/strict";
import { getReservationDisplayLabel, getReservationDisplayName } from "../reservation-display";
import { getReservationDisplayStatus } from "../reservation-display-status";
import { isActiveReservationListItem } from "../reservation-list-policy";

const reservation = (provider: "AIRBNB" | "BOOKING" | "AGODA", guestName: string | null = null, status = "CONFIRMED" as const) => ({ provider, guestName, status });

test("예약자 이름이 없으면 가짜 이름을 만들지 않는다", () => {
  assert.equal(getReservationDisplayName(reservation("AIRBNB")), "예약자 정보 없음");
  assert.equal(getReservationDisplayLabel(reservation("BOOKING")), "예약자 정보 없음");
  assert.equal(getReservationDisplayLabel(reservation("AGODA")), "예약자 정보 없음");
});

test("고객명이 있으면 고객명과 Provider를 표시한다", () => {
  assert.equal(getReservationDisplayName(reservation("AIRBNB", "홍길동")), "홍길동");
  assert.equal(getReservationDisplayLabel(reservation("AIRBNB", "홍길동")), "홍길동 · Airbnb");
});

test("BLOCKED 상태는 Provider 예약으로 표시하지 않는다", () => {
  assert.equal(getReservationDisplayLabel({ provider: "BOOKING", guestName: null, status: "BLOCKED" }, "예약"), "예약");
});

const displayStatus = (reservationStatus: "CONFIRMED" | "CANCELLED", startDate: string, endDate: string, businessDate = "2026-07-27T12:00:00+09:00") => getReservationDisplayStatus({
  reservationStatus,
  startDate: new Date(`${startDate}T00:00:00+09:00`),
  endDate: new Date(`${endDate}T00:00:00+09:00`),
  businessDate: new Date(businessDate),
});

test("Asia/Tokyo 영업일 기준으로 화면 상태를 계산한다", () => {
  assert.equal(displayStatus("CONFIRMED", "2026-07-27", "2026-07-29"), "CHECK_IN_TODAY");
  assert.equal(displayStatus("CONFIRMED", "2026-07-25", "2026-07-27"), "CHECK_OUT_TODAY");
  assert.equal(displayStatus("CONFIRMED", "2026-07-25", "2026-07-29"), "STAYING");
  assert.equal(displayStatus("CONFIRMED", "2026-07-28", "2026-07-30"), "UPCOMING");
  assert.equal(displayStatus("CONFIRMED", "2026-07-21", "2026-07-26"), "PAST");
  assert.equal(displayStatus("CANCELLED", "2026-07-21", "2026-07-26"), "CANCELLED");
});

test("2026.07.21 → 2026.07.27 예약은 종료일에는 오늘 체크아웃, 다음 영업일부터 지난 예약이다", () => {
  assert.equal(displayStatus("CONFIRMED", "2026-07-21", "2026-07-27"), "CHECK_OUT_TODAY");
  assert.equal(displayStatus("CONFIRMED", "2026-07-21", "2026-07-27", "2026-07-28T00:00:00+09:00"), "PAST");
});

test("UTC 날짜가 달라도 Asia/Tokyo 날짜가 같으면 오늘 체크인이다", () => {
  assert.equal(displayStatus("CONFIRMED", "2026-07-27", "2026-07-29", "2026-07-26T15:30:00.000Z"), "CHECK_IN_TODAY");
});

const activeListItem = (reservationStatus: "CONFIRMED" | "TENTATIVE" | "CANCELLED" | "BLOCKED" | "UNKNOWN", endDate: string, businessDate = "2026-07-28T12:00:00+09:00") => isActiveReservationListItem({
  reservationStatus,
  endDate: new Date(`${endDate}T00:00:00+09:00`),
  businessDate: new Date(businessDate),
});

test("활성 예약 목록은 지난 예약과 비운영 DB 상태를 항상 제외한다", () => {
  assert.equal(activeListItem("CONFIRMED", "2026-07-27"), false);
  assert.equal(activeListItem("CANCELLED", "2026-07-29"), false);
  assert.equal(activeListItem("BLOCKED", "2026-07-29"), false);
  assert.equal(activeListItem("UNKNOWN", "2026-07-29"), false);
});

test("오늘 체크아웃·현재 투숙·미래 예약에 해당하는 종료일은 활성 목록에 포함한다", () => {
  assert.equal(activeListItem("CONFIRMED", "2026-07-28"), true);
  assert.equal(activeListItem("TENTATIVE", "2026-07-29"), true);
  assert.equal(activeListItem("CONFIRMED", "2026-08-10"), true);
});

test("활성 목록 날짜 경계는 UTC가 아닌 Asia/Tokyo 운영일을 사용한다", () => {
  assert.equal(activeListItem("CONFIRMED", "2026-07-28", "2026-07-27T15:01:00.000Z"), true);
  assert.equal(activeListItem("CONFIRMED", "2026-07-27", "2026-07-27T15:01:00.000Z"), false);
});
