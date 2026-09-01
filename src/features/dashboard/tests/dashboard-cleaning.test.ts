import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeDashboardCleaning, summarizeDashboardCleaningTasks, type DashboardCleaningTaskStatus } from "../dashboard-cleaning";
import { getDashboardCardIds } from "../dashboard-card-policy";
import { getDashboardDateInput } from "../dashboard-time";
import { buildRoomOperationalSchedule } from "../../room-overview/domain/room-overview";

const start = new Date("2026-07-24T15:00:00.000Z");
const end = new Date("2026-07-25T15:00:00.000Z");
let reservationSequence = 0;
const reservation = (status: string, startDate: string, endDate: string) => ({ id: `reservation-${++reservationSequence}`, guestName: null, provider: "AIRBNB" as const, status: status as "CONFIRMED", startDate: new Date(startDate), endDate: new Date(endDate) });
let roomSequence = 0;
const room = (...reservations: ReturnType<typeof reservation>[]) => ({ id: `room-${++roomSequence}`, name: `${roomSequence}호`, propertyName: "테스트 숙소", reservations });
const counts = (value: ReturnType<typeof summarizeDashboardCleaning>) => ({ priority: value.priority, flexible: value.flexible });
let taskSequence = 0;
const cleaningTask = (status: DashboardCleaningTaskStatus, urgent = false) => ({
  id: `task-${++taskSequence}`,
  status,
  scheduledDate: new Date("2026-07-25T01:00:00Z"),
  reservation: { endDate: new Date("2026-07-25T01:00:00Z") },
  room: {
    id: `task-room-${taskSequence}`,
    name: `${taskSequence}호`,
    property: { name: "테스트 숙소" },
    reservations: urgent ? [{ startDate: new Date("2026-07-25T06:00:00Z") }] : [],
  },
});

test("오늘 체크아웃이 없으면 두 청소 요약은 0이다", () => {
  assert.deepEqual(counts(summarizeDashboardCleaning([room()], start, end)), { priority: 0, flexible: 0 });
});

test("정상 체크아웃 Reservation 13개를 roomId distinct 없이 13건으로 유지한다", () => {
  const checkouts = Array.from({ length: 13 }, (_, index) => ({
    id: `checkout-${index}`,
    guestName: null,
    provider: "BOOKING" as const,
    status: "CONFIRMED" as const,
    startDate: new Date("2026-07-22T06:00:00Z"),
    endDate: new Date("2026-07-25T01:00:00Z"),
  }));
  assert.equal(buildRoomOperationalSchedule(checkouts, start, end, new Date("2026-08-01T15:00:00Z")).todayCheckOuts.length, 13);
});

test("과거 예약은 대시보드 오늘 체크아웃에 포함하지 않는다", () => {
  const past = reservation("CONFIRMED", "2026-08-01T00:00:00Z", "2026-08-05T00:00:00Z");
  const schedule = buildRoomOperationalSchedule(
    [past],
    new Date("2026-08-27T15:00:00Z"),
    new Date("2026-08-28T15:00:00Z"),
    new Date("2026-09-04T15:00:00Z"),
  );
  assert.deepEqual(schedule.todayCheckOuts, []);
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

test("실제 오버부킹으로 동일 객실에 체크아웃 예약이 여러 개면 예약별로 센다", () => {
  const checkout = reservation("CONFIRMED", "2026-07-22T06:00:00Z", "2026-07-25T01:00:00Z");
  assert.deepEqual(counts(summarizeDashboardCleaning([room(checkout, { ...checkout, id: "second-real-reservation" })], start, end)), { priority: 0, flexible: 2 });
});

test("오늘 청소 13건을 미완료 11건과 완료 2건으로 같은 데이터셋에서 집계한다", () => {
  const tasks = [
    ...Array.from({ length: 2 }, () => cleaningTask("PENDING", true)),
    ...Array.from({ length: 3 }, () => cleaningTask("PENDING")),
    ...Array.from({ length: 6 }, () => cleaningTask("IN_PROGRESS")),
    ...Array.from({ length: 2 }, () => cleaningTask("COMPLETED")),
  ];
  const result = summarizeDashboardCleaningTasks(tasks, start, end);
  assert.deepEqual(
    { total: result.total, active: result.active, completed: result.completed, priority: result.priority, flexible: result.flexible },
    { total: 13, active: 11, completed: 2, priority: 2, flexible: 9 },
  );
});

test("취소되거나 예약과 일정이 맞지 않는 청소 작업은 대시보드 합계에서 제외한다", () => {
  const cancelled = cleaningTask("CANCELLED");
  const misaligned = cleaningTask("PENDING");
  misaligned.reservation.endDate = new Date("2026-07-25T02:00:00Z");
  const result = summarizeDashboardCleaningTasks([cancelled, misaligned], start, end);
  assert.deepEqual({ total: result.total, active: result.active, completed: result.completed }, { total: 0, active: 0, completed: 0 });
});

test("대시보드 날짜는 서버 시간대와 무관하게 도쿄 기준으로 만든다", () => {
  assert.equal(getDashboardDateInput(new Date("2026-07-24T15:30:00.000Z")), "2026-07-25");
});

test("STAFF 대시보드는 청소 완료와 청소 관리를 포함한 7개 카드를 표시한다", () => {
  assert.deepEqual(getDashboardCardIds("STAFF"), [
    "today-check-in",
    "today-check-out",
    "overbooking",
    "priority-cleaning",
    "flexible-cleaning",
    "completed-cleaning",
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
    "completed-cleaning",
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

test("체크인·체크아웃과 청소 합계는 동일한 운영 예약·영업일 경계를 사용한다", () => {
  const dashboard = readFileSync("src/features/dashboard/dashboard.repository.ts", "utf8");
  const cleaning = readFileSync("src/features/cleaning/server/cleaning-dashboard.repository.ts", "utf8");
  const cleaningWhere = readFileSync("src/features/cleaning/server/cleaning-task-query.ts", "utf8");
  assert.match(dashboard, /roomOverview\.operationalSchedule\.todayCheckIns\.length/);
  assert.match(dashboard, /roomOverview\.operationalSchedule\.todayCheckOuts\.length/);
  assert.match(cleaning, /buildCheckoutCleaningTaskWhere/);
  assert.match(cleaning, /summarizeDashboardCleaningTasks/);
  assert.match(cleaningWhere, /scheduledDate: \{ gt: input\.start, lte: input\.end \}/);
  assert.match(cleaningWhere, /reservation: \{[\s\S]*buildOperationalReservationWhere/);
});

test("청소 완료와 청소 관리 카드는 같은 요약 필드와 기존 경로를 사용하고 모바일은 2열을 유지한다", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /"completed-cleaning": \{[\s\S]*count: summary\.completedCleaning[\s\S]*status=COMPLETED/);
  assert.match(page, /"cleaning-management": \{[\s\S]*count: summary\.totalCleaning/);
  assert.match(page, /href: context \? `\/cleaning\?date=\$\{today\}`/);
  assert.match(page, /className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3"/);
});
