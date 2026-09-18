import assert from "node:assert/strict";
import test from "node:test";

import {
  doReservationDateRangesOverlap,
  getReservationDateInput,
  getReservationNightCount,
  isReservationCheckInOnDate,
  isReservationCheckOutOnDate,
  isReservationOccupiedOnDate,
  isSameReservationDate,
} from "../reservation-date";

const tokyoMidnight = (date: string) => new Date(`${date}T00:00:00+09:00`);
const stay = (startDate: string, endDate: string) => ({
  startDate: tokyoMidnight(startDate),
  endDate: tokyoMidnight(endDate),
});

test("9/17 체크인, 9/18 체크아웃은 1박 [startDate, endDate) 예약이다", () => {
  const reservation = stay("2026-09-17", "2026-09-18");
  assert.equal(getReservationNightCount(reservation), 1);
  assert.equal(isReservationOccupiedOnDate(reservation, "2026-09-17"), true);
  assert.equal(isReservationOccupiedOnDate(reservation, "2026-09-18"), false);
  assert.equal(isReservationCheckOutOnDate(reservation, "2026-09-18"), true);
});

test("2박 예약은 9/17에서 9/19 체크아웃 경계까지 계산한다", () => {
  const reservation = stay("2026-09-17", "2026-09-19");
  assert.equal(getReservationNightCount(reservation), 2);
  assert.equal(isReservationCheckOutOnDate(reservation, "2026-09-19"), true);
});

test("9/18 체크인은 오늘 체크인이지만 오늘 체크아웃이나 오늘 청소 기준은 아니다", () => {
  const reservation = stay("2026-09-18", "2026-09-19");
  assert.equal(isReservationCheckInOnDate(reservation, "2026-09-18"), true);
  assert.equal(isReservationCheckOutOnDate(reservation, "2026-09-18"), false);
  assert.equal(isReservationCheckOutOnDate(reservation, "2026-09-19"), true);
});

test("같은 Tokyo 업무 날짜의 서로 다른 시각은 같은 체크아웃·청소 날짜다", () => {
  assert.equal(isSameReservationDate(
    new Date("2026-09-17T15:00:00.000Z"),
    new Date("2026-09-18T06:00:00.000Z"),
  ), true);
  assert.equal(getReservationDateInput(new Date("2026-09-17T15:00:00.000Z")), "2026-09-18");
});

test("체크아웃과 다음 체크인이 같은 정상 turnover는 오버부킹이 아니다", () => {
  assert.equal(doReservationDateRangesOverlap(
    stay("2026-09-17", "2026-09-18"),
    stay("2026-09-18", "2026-09-20"),
  ), false);
  assert.equal(doReservationDateRangesOverlap(
    stay("2026-09-17", "2026-09-19"),
    stay("2026-09-18", "2026-09-20"),
  ), true);
});
