import test from "node:test";
import assert from "node:assert/strict";
import { getReservationDisplayLabel, getReservationDisplayName } from "../reservation-display";

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
