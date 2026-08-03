import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeDashboardCleaning } from "../dashboard-cleaning";
import { getDashboardCardIds } from "../dashboard-card-policy";
import { getDashboardDateInput } from "../dashboard-time";

const start = new Date("2026-07-24T15:00:00.000Z");
const end = new Date("2026-07-25T15:00:00.000Z");
let reservationSequence = 0;
const reservation = (status: string, startDate: string, endDate: string) => ({ id: `reservation-${++reservationSequence}`, guestName: null, provider: "AIRBNB" as const, status: status as "CONFIRMED", startDate: new Date(startDate), endDate: new Date(endDate) });
let roomSequence = 0;
const room = (...reservations: ReturnType<typeof reservation>[]) => ({ id: `room-${++roomSequence}`, name: `${roomSequence}호`, propertyName: "테스트 숙소", reservations });
const counts = (value: ReturnType<typeof summarizeDashboardCleaning>) => ({ priority: value.priority, flexible: value.flexible });

test("오늘 체크아웃이 없으면 두 청소 요약은 0이다", () => {
  assert.deepEqual(counts(summarizeDashboardCleaning([room()], start, end)), { priority: 0, flexible: 0 });
});

test("오늘 체크아웃 후 당일 체크인이 있으면 객실을 우선 청소로 센다", () => {
  const result = summarizeDashboardCleaning([room(
    reservation("CONFIRMED", "2026-07-22T06:00:00Z", "2026-07-25T01:00:00Z"),
    reservation("TENTATIVE", "2026-07-25T06:00:00Z", "2026-07-27T01:00:00Z"),
  )], start, end);
  assert.deepEqual(counts(result), { priority: 1, flexible: 0 });
});

test("오늘 체크아웃 후 당일 체크인이 없으면 객실을 여유 청소로 센다", () => {
  const result = summarizeDashboardCleaning([room(reservation("CONFIRMED", "2026-07-22T06:00:00Z", "2026-07-25T01:00:00Z"))], start, end);
  assert.deepEqual(counts(result), { priority: 0, flexible: 1 });
});

test("BLOCKED, UNKNOWN, CANCELLED 일정은 체크아웃과 체크인 계산에서 제외한다", () => {
  const excludedStatuses = ["BLOCKED", "UNKNOWN", "CANCELLED"];
  const rooms = excludedStatuses.map((status) => room(reservation(status, "2026-07-22T06:00:00Z", "2026-07-25T01:00:00Z")));
  assert.deepEqual(counts(summarizeDashboardCleaning(rooms, start, end)), { priority: 0, flexible: 0 });
});

test("동일 객실에 체크아웃 예약이 여러 개여도 객실은 한 번만 센다", () => {
  const checkout = reservation("CONFIRMED", "2026-07-22T06:00:00Z", "2026-07-25T01:00:00Z");
  assert.deepEqual(counts(summarizeDashboardCleaning([room(checkout, { ...checkout, id: "duplicate" })], start, end)), { priority: 0, flexible: 1 });
});

test("대시보드 날짜는 서버 시간대와 무관하게 도쿄 기준으로 만든다", () => {
  assert.equal(getDashboardDateInput(new Date("2026-07-24T15:30:00.000Z")), "2026-07-25");
});

test("STAFF 대시보드는 청소 관리를 포함한 6개 카드만 표시한다", () => {
  assert.deepEqual(getDashboardCardIds("STAFF"), [
    "today-check-in",
    "today-check-out",
    "overbooking",
    "priority-cleaning",
    "flexible-cleaning",
    "cleaning-management",
  ]);
});

test("ADMIN과 DEVELOPER 대시보드는 청소 관리 다음에 동기화 실패를 표시한다", () => {
  const expected = [
    "today-check-in",
    "today-check-out",
    "overbooking",
    "priority-cleaning",
    "flexible-cleaning",
    "cleaning-management",
    "sync-failure",
  ];
  assert.deepEqual(getDashboardCardIds("ADMIN"), expected);
  assert.deepEqual(getDashboardCardIds("DEVELOPER"), expected);
});

test("대시보드 역할과 동기화 조회는 effectiveRole 권한을 기준으로 한다", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  const repository = readFileSync("src/features/dashboard/dashboard.repository.ts", "utf8");
  assert.match(page, /dashboardRole = context\?\.effectiveRole \?\? context\?\.role/);
  assert.match(page, /hasPermission\(dashboardRole, PERMISSIONS\.SYNC_READ\)/);
  assert.match(page, /includeSyncFailures: canReadSyncFailures/);
  assert.match(repository, /includeSyncFailures\s*\? prisma\.syncLog\.count/);
  assert.match(repository, /includeSyncFailures\s*\? prisma\.syncLog\.findFirst/);
});

test("청소 관리 카드는 기존 청소 합계와 경로를 재사용하고 모바일은 2열을 유지한다", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /"cleaning-management": \{[\s\S]*count: summary\.priorityCleaning \+ summary\.flexibleCleaning/);
  assert.match(page, /href: context \? `\/cleaning\?date=\$\{today\}`/);
  assert.match(page, /className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3"/);
});
