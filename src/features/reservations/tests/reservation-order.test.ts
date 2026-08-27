import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compareReservationDefaultOrder,
  RESERVATION_DEFAULT_ORDER_BY,
  type ReservationDefaultOrderValue,
} from "../reservation-order";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function reservation(
  id: string,
  propertyName: string,
  roomName: string,
  roomSortOrder: number,
  startDate = "2026-08-27",
  endDate = "2026-08-28",
): ReservationDefaultOrderValue {
  return {
    id,
    propertyId: `property-${propertyName}`,
    propertyName,
    roomId: `room-${propertyName}-${roomName}`,
    roomName,
    roomSortOrder,
    startDate: day(startDate),
    endDate: day(endDate),
  };
}

const sort = (items: ReservationDefaultOrderValue[]) => [...items].sort(compareReservationDefaultOrder);

test("여러 숙소 예약은 숙소명 가나다순으로 정렬한다", () => {
  const items = sort([
    reservation("3", "하이츠요시노", "503", 503),
    reservation("1", "그란", "303", 303),
    reservation("2", "가르데니아", "501", 501),
    reservation("4", "선샤인", "406", 406),
  ]);
  assert.deepEqual(items.map((item) => item.propertyName), ["가르데니아", "그란", "선샤인", "하이츠요시노"]);
});

test("같은 숙소의 101·201·1002 객실은 room.sortOrder 숫자 의미대로 정렬한다", () => {
  const items = sort([
    reservation("1002", "센터코즈", "1002", 1002),
    reservation("201", "센터코즈", "201", 201),
    reservation("101", "센터코즈", "101", 101),
  ]);
  assert.deepEqual(items.map((item) => item.roomName), ["101", "201", "1002"]);
});

test("오늘 체크아웃 결과도 숙소·객실 기본 정렬을 유지한다", () => {
  const today = day("2026-08-27");
  const checkoutRows = [
    reservation("b", "선샤인", "406", 406, "2026-08-25", "2026-08-27"),
    reservation("a", "그란", "303", 303, "2026-08-26", "2026-08-27"),
  ].filter((item) => item.endDate.getTime() === today.getTime());
  assert.deepEqual(sort(checkoutRows).map((item) => item.propertyName), ["그란", "선샤인"]);
});

test("오늘 체크인 결과도 숙소·객실 기본 정렬을 유지한다", () => {
  const today = day("2026-08-27");
  const checkinRows = [
    reservation("b", "인터시티", "301", 301, "2026-08-27", "2026-08-30"),
    reservation("a", "가르데니아", "501", 501, "2026-08-27", "2026-08-29"),
  ].filter((item) => item.startDate.getTime() === today.getTime());
  assert.deepEqual(sort(checkinRows).map((item) => item.propertyName), ["가르데니아", "인터시티"]);
});

test("숙소 필터 결과는 해당 숙소 안에서 객실 숫자 순서를 유지한다", () => {
  const propertyName = "센터코즈";
  const rows = [
    reservation("other", "그란", "303", 303),
    reservation("1002", propertyName, "1002", 1002),
    reservation("201", propertyName, "201", 201),
  ].filter((item) => item.propertyName === propertyName);
  assert.deepEqual(sort(rows).map((item) => item.roomName), ["201", "1002"]);
});

test("안정적인 tie-breaker를 페이지네이션 전에 적용해 페이지 경계에서도 순서가 유지된다", () => {
  const rows = Array.from({ length: 30 }, (_, index) => reservation(
    `reservation-${String(index).padStart(2, "0")}`,
    index < 15 ? "가르데니아" : "그란",
    String(101 + (index % 15)),
    101 + (index % 15),
  )).reverse();
  const ordered = sort(rows);
  const firstPage = ordered.slice(0, 25);
  const secondPage = ordered.slice(25, 50);
  assert.deepEqual([...firstPage, ...secondPage], ordered);
  assert.equal(firstPage.at(-1)?.id, "reservation-24");
  assert.equal(secondPage.at(0)?.id, "reservation-25");
});

test("Prisma 목록 쿼리는 공통 orderBy를 skip/take와 함께 DB 단계에서 사용한다", () => {
  assert.deepEqual(RESERVATION_DEFAULT_ORDER_BY, [
    { property: { name: "asc" } },
    { propertyId: "asc" },
    { room: { sortOrder: "asc" } },
    { room: { name: "asc" } },
    { roomId: "asc" },
    { startDate: "asc" },
    { endDate: "asc" },
    { id: "asc" },
  ]);
  const repository = readFileSync("src/features/reservations/reservation.repository.ts", "utf8");
  const orderIndex = repository.indexOf("orderBy: [...RESERVATION_DEFAULT_ORDER_BY]");
  const skipIndex = repository.indexOf("skip: (filters.page - 1) * RESERVATION_PAGE_SIZE");
  const takeIndex = repository.indexOf("take: RESERVATION_PAGE_SIZE");
  assert.ok(orderIndex >= 0 && skipIndex > orderIndex && takeIndex > skipIndex);
  assert.doesNotMatch(repository, /rows\.sort\(/);
});
