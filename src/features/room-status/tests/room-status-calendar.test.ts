import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
import {
  buildRoomStatusReservationWhere,
  getRoomStatusReservationPlacement,
  getRoomStatusCalendarRange,
  isReservationVisibleInRoomStatusRange,
  shiftRoomStatusMonth,
} from "../room-status-calendar";

const july = getRoomStatusCalendarRange("2026-07", new Date("2026-08-14T00:00:00+09:00"));
const august = getRoomStatusCalendarRange("2026-08", new Date("2026-08-14T00:00:00+09:00"));
const september = getRoomStatusCalendarRange("2026-09", new Date("2026-08-14T00:00:00+09:00"));

function reservation(
  startDate: string,
  endDate: string,
  provider: CalendarProviderType = "AIRBNB",
  status: ReservationStatus = "CONFIRMED",
) {
  return { startDate: new Date(startDate), endDate: new Date(endDate), provider, status };
}

test("선택 월은 현재 월과 무관하게 Asia/Tokyo 월 경계를 만든다", () => {
  assert.equal(july.month, "2026-07");
  assert.equal(july.rangeStart.toISOString(), "2026-06-30T15:00:00.000Z");
  assert.equal(july.rangeEnd.toISOString(), "2026-07-31T15:00:00.000Z");
  assert.equal(shiftRoomStatusMonth("2026-07", -1), "2026-06");
  assert.equal(shiftRoomStatusMonth("2026-07", 1), "2026-08");
});

test("Prisma 조회 조건은 현재 날짜가 아닌 선택 월 overlap 범위를 사용한다", () => {
  const where = buildRoomStatusReservationWhere(july);
  assert.deepEqual(where.status, { in: ["CONFIRMED", "TENTATIVE"] });
  assert.deepEqual(where.provider, { in: ["AIRBNB", "BOOKING", "AGODA"] });
  assert.deepEqual(where.calendarSource, { is: { isActive: true } });
  assert.deepEqual(where.startDate, { lt: july.rangeEnd });
  assert.deepEqual(where.endDate, { gt: july.rangeStart });
  assert.deepEqual(where.room, {
    is: {
      isActive: true,
      property: { isActive: true, company: { isActive: true } },
    },
  });
});

test("현재가 8월이어도 7월 정상 예약을 표시한다", () => {
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-07-10T00:00:00+09:00", "2026-07-12T00:00:00+09:00"), july), true);
});

test("현재가 체크아웃 당일이어도 선택 범위의 Booking 예약을 표시한다", () => {
  const viewedRange = {
    rangeStart: new Date("2026-09-10T15:00:00.000Z"),
    rangeEnd: new Date("2026-09-27T15:00:00.000Z"),
  };
  const booking = reservation(
    "2026-09-14T15:00:00.000Z",
    "2026-09-16T15:00:00.000Z",
    "BOOKING",
  );
  assert.equal(isReservationVisibleInRoomStatusRange(booking, viewedRange), true);
});

test("1박과 2박 예약은 체크아웃 날짜 경계까지 정확한 막대 길이를 사용한다", () => {
  assert.deepEqual(getRoomStatusReservationPlacement(
    reservation("2026-09-17T00:00:00+09:00", "2026-09-18T00:00:00+09:00"),
    "2026-09-01",
    30,
  ), {
    startDateInput: "2026-09-17",
    endDateInput: "2026-09-18",
    leftDays: 16,
    durationDays: 1,
  });
  assert.equal(getRoomStatusReservationPlacement(
    reservation("2026-09-17T00:00:00+09:00", "2026-09-19T00:00:00+09:00"),
    "2026-09-01",
    30,
  )?.durationDays, 2);
});

test("오늘이 9월 18일이어도 9월 캘린더는 과거·경계·미래 overlap 예약을 모두 표시한다", () => {
  const septemberRange = getRoomStatusCalendarRange("2026-09", new Date("2026-09-18T12:00:00+09:00"));
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-09-01T00:00:00+09:00", "2026-09-03T00:00:00+09:00"), septemberRange), true);
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-09-15T00:00:00+09:00", "2026-09-17T00:00:00+09:00"), septemberRange), true);
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-08-30T00:00:00+09:00", "2026-09-02T00:00:00+09:00"), septemberRange), true);
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-09-30T00:00:00+09:00", "2026-10-03T00:00:00+09:00"), septemberRange), true);
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-08-01T00:00:00+09:00", "2026-08-05T00:00:00+09:00"), septemberRange), false);
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-10-01T00:00:00+09:00", "2026-10-03T00:00:00+09:00"), septemberRange), false);
  assert.deepEqual(getRoomStatusReservationPlacement(reservation("2026-08-30T00:00:00+09:00", "2026-09-02T00:00:00+09:00"), "2026-09-01", 42), {
    startDateInput: "2026-08-30",
    endDateInput: "2026-09-02",
    leftDays: 0,
    durationDays: 1,
  });
  assert.deepEqual(getRoomStatusReservationPlacement(reservation("2026-09-30T00:00:00+09:00", "2026-10-03T00:00:00+09:00"), "2026-09-01", 42), {
    startDateInput: "2026-09-30",
    endDateInput: "2026-10-03",
    leftDays: 29,
    durationDays: 3,
  });
  assert.equal(getRoomStatusReservationPlacement(reservation("2026-08-01T00:00:00+09:00", "2026-08-05T00:00:00+09:00"), "2026-09-01", 42), null);
});

test("이전 달에서 넘어오거나 다음 달까지 이어지는 예약을 양쪽 월에 표시한다", () => {
  const fromJune = reservation("2026-06-30T00:00:00+09:00", "2026-07-02T00:00:00+09:00");
  const intoAugust = reservation("2026-07-31T00:00:00+09:00", "2026-08-03T00:00:00+09:00");
  assert.equal(isReservationVisibleInRoomStatusRange(fromJune, july), true);
  assert.equal(isReservationVisibleInRoomStatusRange(intoAugust, july), true);
  assert.equal(isReservationVisibleInRoomStatusRange(intoAugust, august), true);
});

test("범위 밖 예약은 제외하고 미래 월 선택은 정상 표시한다", () => {
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-06-01T00:00:00+09:00", "2026-06-03T00:00:00+09:00"), july), false);
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-09-10T00:00:00+09:00", "2026-09-12T00:00:00+09:00"), september), true);
});

test("3개월보다 오래된 월도 직접 이동하면 DB 예약을 같은 overlap 정책으로 표시한다", () => {
  const historicalMonth = getRoomStatusCalendarRange("2025-09", new Date("2026-09-21T12:00:00+09:00"));
  assert.equal(isReservationVisibleInRoomStatusRange(
    reservation("2025-09-10T00:00:00+09:00", "2025-09-12T00:00:00+09:00"),
    historicalMonth,
  ), true);
  const where = buildRoomStatusReservationWhere(historicalMonth);
  assert.deepEqual(where.startDate, { lt: historicalMonth.rangeEnd });
  assert.deepEqual(where.endDate, { gt: historicalMonth.rangeStart });
});

test("취소 예약은 제외하고 OTA Provider 모두 동일한 overlap 규칙을 사용한다", () => {
  const providers = ["AIRBNB", "BOOKING", "AGODA"] as const;
  for (const provider of providers) {
    assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-07-10T00:00:00+09:00", "2026-07-12T00:00:00+09:00", provider), july), true);
  }
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-07-10T00:00:00+09:00", "2026-07-12T00:00:00+09:00", "AIRBNB", "CANCELLED"), july), false);
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-07-10T00:00:00+09:00", "2026-07-12T00:00:00+09:00", "EXPEDIA"), july), false);
  assert.equal(isReservationVisibleInRoomStatusRange(reservation("2026-07-10T00:00:00+09:00", "2026-07-12T00:00:00+09:00", "VRBO"), july), false);
});

test("월 URL과 서버 repository가 같은 명시적 범위를 사용한다", () => {
  const page = readFileSync("src/app/room-status/page.tsx", "utf8");
  const repository = readFileSync("src/features/room-status/room-status.repository.ts", "utf8");
  const domain = readFileSync("src/features/room-status/room-status-calendar.ts", "utf8");
  const calendar = readFileSync("src/features/room-status/components/monthly-reservation-calendar.tsx", "utf8");
  assert.match(page, /getRoomStatusCalendarRange\(value\("month"\)\)/);
  assert.match(page, /month: targetMonth/);
  assert.match(page, /rangeStart: calendarRange\.rangeStart/);
  assert.match(page, /rangeEnd: calendarRange\.rangeEnd/);
  assert.match(repository, /where: buildRoomStatusReservationWhere\(input\)/);
  assert.doesNotMatch(repository, /new Date\(\)|endDate: \{ gte:|startDate: \{ gte:/);
  assert.match(domain, /getReservationDateInput\(reservation\.startDate, ROOM_STATUS_TIME_ZONE\)/);
  assert.match(domain, /getReservationDateInput\(reservation\.endDate, ROOM_STATUS_TIME_ZONE\)/);
  assert.match(calendar, /viewportRef\.current\.scrollLeft = 0/);
  assert.match(calendar, /const width = placement\.durationDays \* DAY_WIDTH/);
  assert.match(calendar, /left=\{placement\.leftDays \* DAY_WIDTH\}/);
  assert.doesNotMatch(calendar, /scrollLeft = Math\.max\(0, todayIndex/);
  assert.doesNotMatch(calendar, /reservation\.startDate\.getFullYear|reservation\.endDate\.getFullYear/);
});
