import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRoomOperationalSchedule, calculateRoomOverviewStatus, getReservationOperationalDay, getRoomOverviewGuestName, getRoomOverviewStatusLabel, matchesRoomOperationalStatus, requiresRoomInspection, sortRoomOverviewCards, summarizeRoomOverview, type RoomOverviewCard, type RoomOverviewReservation } from "../domain/room-overview";
import { buildCalendarDateRange, buildMobileRoomCalendarSegments, filterMobileRooms, getCalendarRangeStart, groupRoomsForCalendar, moveRoomOverviewDate, parseCalendarRangeDays, parseRoomOverviewDateKey, sortMobileRooms, summarizeMobileRooms } from "../domain/room-overview-mobile";
import { getRoomOperationalStatusLabel } from "../../rooms/room-operational-status";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, BedDouble, BrushCleaning, House, Wrench } from "lucide-react";
import { getRoomStatusThemeStatus, ROOM_STATUS_THEME } from "../room-overview-visuals";
import { updateRoomOverviewFilterParams } from "../domain/room-overview-filter";

const todayStart = new Date("2026-07-24T00:00:00+09:00");
const todayEnd = new Date("2026-07-25T00:00:00+09:00");
const reservation = (overrides: Partial<RoomOverviewReservation> = {}): RoomOverviewReservation => ({ id: "r1", guestName: null, provider: "AIRBNB", status: "CONFIRMED", startDate: new Date("2026-07-26T00:00:00+09:00"), endDate: new Date("2026-07-28T00:00:00+09:00"), activeConflicts: [], ...overrides });
const status = (reservations: RoomOverviewReservation[], activeConflictCount = 0) => calculateRoomOverviewStatus({ reservations, activeConflictCount, todayStart, todayEnd });

test("예약이 없거나 미래 예약만 있으면 VACANT다", () => { assert.equal(status([]), "VACANT"); assert.equal(status([reservation()]), "VACANT"); });
test("과거 예약만 있으면 객실 운영 상태는 VACANT를 유지한다", () => assert.equal(status([reservation({ startDate: new Date("2026-07-01T00:00:00+09:00"), endDate: new Date("2026-07-05T00:00:00+09:00") })]), "VACANT"));
test("오늘 체크인 상태를 계산한다", () => assert.equal(status([reservation({ startDate: todayStart })]), "CHECK_IN_TODAY"));
test("현재 투숙 상태를 계산한다", () => assert.equal(status([reservation({ startDate: new Date("2026-07-23T00:00:00+09:00"), endDate: new Date("2026-07-26T00:00:00+09:00") })]), "OCCUPIED"));
test("오늘 체크아웃 상태를 계산한다", () => assert.equal(status([reservation({ startDate: new Date("2026-07-22T00:00:00+09:00"), endDate: todayStart })]), "CHECK_OUT_TODAY"));
test("오늘 시작 경계의 체크아웃을 모든 운영 계산에서 오늘로 분류한다", () => {
  const item = reservation({ startDate: new Date("2026-07-22T00:00:00+09:00"), endDate: todayStart });
  const day = getReservationOperationalDay(item, todayStart, todayEnd);
  const schedule = buildRoomOperationalSchedule([item], todayStart, todayEnd, new Date("2026-08-01T00:00:00+09:00"));

  assert.equal(day.isTodayCheckOut, true);
  assert.deepEqual(schedule.todayCheckOuts.map(({ id }) => id), [item.id]);
  assert.deepEqual(schedule.nextCheckOuts, []);
});
test("BLOCKED만 있으면 VACANT다", () => assert.equal(status([reservation({ status: "BLOCKED", startDate: todayStart, endDate: todayEnd })]), "VACANT"));
test("UNKNOWN은 운영 상태에서 제외하고 TENTATIVE는 실제 예약으로 취급한다", () => {
  assert.equal(status([reservation({ status: "UNKNOWN", startDate: todayStart, endDate: todayEnd })]), "VACANT");
  assert.equal(status([reservation({ status: "TENTATIVE", startDate: todayStart, endDate: new Date("2026-07-26T00:00:00+09:00") })]), "CHECK_IN_TODAY");
});
test("ACTIVE 충돌이 모든 상태보다 우선한다", () => assert.equal(status([reservation({ startDate: todayStart })], 1), "CONFLICT"));
test("CANCELLED와 잘못된 날짜는 상태 계산에서 제외한다", () => { assert.equal(status([reservation({ status: "CANCELLED", startDate: todayStart })]), "VACANT"); assert.equal(status([reservation({ startDate: new Date(Number.NaN) })]), "VACANT"); });
test("여러 예약에서는 체크아웃 우선순위를 적용한다", () => assert.equal(status([reservation({ startDate: todayStart }), reservation({ id: "r2", startDate: new Date("2026-07-20T00:00:00+09:00"), endDate: todayStart })]), "CHECK_OUT_TODAY"));
test("오늘 체크아웃과 체크인이 겹치는 turnover는 체크아웃 우선순위를 유지한다", () => {
  const checkingOut = reservation({ id: "out", startDate: new Date("2026-07-20T00:00:00+09:00"), endDate: todayStart });
  const checkingIn = reservation({ id: "in", startDate: todayStart, endDate: new Date("2026-07-27T00:00:00+09:00") });
  assert.equal(status([checkingIn, checkingOut]), "CHECK_OUT_TODAY");
});
test("예약자 이름이 없으면 가짜 이름을 만들지 않는다", () => { assert.equal(getRoomOverviewGuestName(reservation({ guestName: "Kim" })), "Kim"); assert.equal(getRoomOverviewGuestName(reservation()), "예약자 정보 없음"); assert.equal(getRoomOverviewGuestName(reservation({ status: "BLOCKED" })), "예약자 정보 없음"); assert.equal(getRoomOverviewGuestName(reservation({ provider: "BOOKING" })), "예약자 정보 없음"); });

const card = (overrides: Partial<RoomOverviewCard>): RoomOverviewCard => ({ id: "1", propertyId: "p", propertyName: "세레니테", name: "객실", code: "801", sortOrder: 0, operationalStatus: "NONE", operationalStatusUpdatedAt: null, status: "VACANT", currentReservation: null, nextReservation: null, nextReservationLeadDays: null, reservationCount: 0, activeConflictCount: 0, pendingMemoCount: 0, providers: [], latestSync: null, syncStates: [], reservations: [], ...overrides });
test("객실은 숙소·sortOrder·객실 코드 순서로 정렬한다", () => { const result = sortRoomOverviewCards([card({ id: "801", code: "801", sortOrder: 2 }), card({ id: "303", code: "303", sortOrder: 1 }), card({ id: "701", code: "701", sortOrder: 2 })]); assert.deepEqual(result.map((item) => item.id), ["303", "701", "801"]); });
test("자동 상태와 청소 상태·미완료 메모 기반 점검 상태를 집계한다", () => { const result = summarizeRoomOverview([card({ status: "VACANT" }), card({ id: "2", status: "OCCUPIED", operationalStatus: "CLEANING_REQUIRED" }), card({ id: "3", status: "CONFLICT", pendingMemoCount: 2 })]); assert.equal(result.total, 3); assert.equal(result.statuses.VACANT, 1); assert.equal(result.statuses.CONFLICT, 1); assert.equal(result.operationalStatuses.CLEANING_REQUIRED, 1); assert.equal(result.operationalStatuses.INSPECTION_REQUIRED, 1); });
test("점검 필요는 OPEN 객실 메모 집계 수가 1개 이상일 때만 판정한다", () => {
  assert.equal(requiresRoomInspection(card({ pendingMemoCount: 0 })), false);
  assert.equal(requiresRoomInspection(card({ pendingMemoCount: 1 })), true);
  assert.equal(requiresRoomInspection(card({ pendingMemoCount: 3 })), true);
  assert.equal(matchesRoomOperationalStatus(card({ pendingMemoCount: 2 }), "INSPECTION_REQUIRED"), true);
  assert.equal(matchesRoomOperationalStatus(card({ pendingMemoCount: 0, operationalStatus: "INSPECTION_REQUIRED" }), "INSPECTION_REQUIRED"), false);
});
test("CONFLICT는 번역 키를 통해 오버부킹으로 표시한다", () => assert.equal(getRoomOverviewStatusLabel("CONFLICT", () => "오버부킹"), "오버부킹"));
test("수동 운영 상태 표시 문자열을 번역 키로 구분한다", () => {
  const labels = { "roomStatus.NONE": "상태 없음", "roomStatus.CLEANING_REQUIRED": "청소 필요", "roomStatus.INSPECTION_REQUIRED": "점검 필요" } as const;
  const translate = (key: keyof typeof labels) => labels[key];
  assert.equal(getRoomOperationalStatusLabel("NONE", translate), "상태 없음");
  assert.equal(getRoomOperationalStatusLabel("CLEANING_REQUIRED", translate), "청소 필요");
  assert.equal(getRoomOperationalStatusLabel("INSPECTION_REQUIRED", translate), "점검 필요");
});
test("오버부킹과 청소 필요 상태를 동시에 보존한다", () => { const value = card({ status: "CONFLICT", operationalStatus: "CLEANING_REQUIRED" }); assert.equal(value.status, "CONFLICT"); assert.equal(value.operationalStatus, "CLEANING_REQUIRED"); });

test("객실 상태 테마는 7개 상태의 색상·아이콘·다크 모드를 한 곳에서 관리한다", () => {
  assert.deepEqual(Object.keys(ROOM_STATUS_THEME), ["VACANT", "CHECK_IN_TODAY", "CHECK_OUT_TODAY", "OCCUPIED", "CONFLICT", "INSPECTION_REQUIRED", "CLEANING_REQUIRED"]);
  const expected = {
    VACANT: { color: "blue", icon: House },
    CHECK_IN_TODAY: { color: "green", icon: ArrowDownToLine },
    CHECK_OUT_TODAY: { color: "orange", icon: ArrowUpFromLine },
    OCCUPIED: { color: "purple", icon: BedDouble },
    CONFLICT: { color: "red", icon: AlertTriangle },
    INSPECTION_REQUIRED: { color: "gray", badgeColor: "red", icon: Wrench },
    CLEANING_REQUIRED: { color: "amber", icon: BrushCleaning },
  } as const;

  for (const [status, expectation] of Object.entries(expected)) {
    const theme = ROOM_STATUS_THEME[status as keyof typeof ROOM_STATUS_THEME];
    assert.match(theme.headerClass, new RegExp(`bg-${expectation.color}-`));
    assert.match(theme.bodyClass, new RegExp(`bg-${expectation.color}-`));
    assert.match(theme.badgeClass, new RegExp(`border-${"badgeColor" in expectation ? expectation.badgeColor : expectation.color}-`));
    assert.match(`${theme.headerClass} ${theme.bodyClass} ${theme.badgeClass}`, /dark:/);
    assert.equal(theme.icon, expectation.icon);
  }
});

test("오버부킹과 운영 상태의 표시 우선순위를 유지한다", () => {
  assert.equal(getRoomStatusThemeStatus(card({ status: "CONFLICT", operationalStatus: "CLEANING_REQUIRED" })), "CONFLICT");
  assert.equal(getRoomStatusThemeStatus(card({ status: "OCCUPIED", operationalStatus: "CLEANING_REQUIRED" })), "CLEANING_REQUIRED");
  assert.equal(getRoomStatusThemeStatus(card({ status: "VACANT", operationalStatus: "INSPECTION_REQUIRED" })), "VACANT");
  assert.equal(getRoomStatusThemeStatus(card({ status: "CHECK_IN_TODAY" })), "CHECK_IN_TODAY");
});

test("객실 카드 점검 배지는 OPEN 메모 count를 사용하고 정상 상태 문구는 렌더링하지 않는다", () => {
  const repository = readFileSync("src/features/room-overview/infrastructure/room-overview.repository.ts", "utf8");
  const desktopCard = readFileSync("src/features/room-overview/components/room-overview-card.tsx", "utf8");
  const mobileCard = readFileSync("src/features/room-overview/components/compact-room-status-card.tsx", "utf8");

  assert.match(repository, /roomNotes: \{ some: \{ status: OPEN_ROOM_NOTE_STATUS \} \}/);
  assert.match(repository, /_count: \{ select: \{ roomNotes: \{ where: \{ status: OPEN_ROOM_NOTE_STATUS \} \} \} \}/);
  assert.doesNotMatch(repository, /prisma\.roomNote\.(findMany|count)/);
  assert.match(desktopCard, /requiresRoomInspection\(card\)/);
  assert.match(desktopCard, /\/room-notes\?propertyId=/);
  assert.doesNotMatch(desktopCard, /i18n\("sync\.normal"\)/);
  assert.doesNotMatch(desktopCard, /i18n\("conflict\.none"\)/);
  assert.match(desktopCard, /sync\.status === "FAILED" \|\| sync\.status === "TIMEOUT"/);
  assert.match(desktopCard, /card\.activeConflictCount > 0/);
  assert.match(mobileCard, /requiresRoomInspection\(room\)/);
  assert.match(mobileCard, /sync\.error/);
  assert.match(mobileCard, /room\.activeConflictCount > 0/);
});

test("점검 필요 카드는 상태 배경을 유지하면서 PC·모바일에서 빨간 테두리와 강조 badge를 사용한다", () => {
  const visuals = readFileSync("src/features/room-overview/room-overview-visuals.ts", "utf8");
  const desktopCard = readFileSync("src/features/room-overview/components/room-overview-card.tsx", "utf8");
  const mobileCard = readFileSync("src/features/room-overview/components/compact-room-status-card.tsx", "utf8");

  assert.match(visuals, /ROOM_INSPECTION_BORDER_CLASS = "border-2 border-red-500\/80[^\"]+dark:border-red-500\/80/);
  assert.match(ROOM_STATUS_THEME.INSPECTION_REQUIRED.badgeClass, /border-red-500/);
  assert.match(ROOM_STATUS_THEME.INSPECTION_REQUIRED.badgeClass, /dark:bg-red-950/);
  assert.match(desktopCard, /inspectionRequired && themeStatus !== "CONFLICT" && ROOM_INSPECTION_BORDER_CLASS/);
  assert.match(mobileCard, /inspectionRequired && room\.activeConflictCount === 0 && ROOM_INSPECTION_BORDER_CLASS/);
  assert.match(desktopCard, /data-room-inspection-required/);
  assert.match(mobileCard, /data-room-inspection-required/);
});

test("점검 필요 요약 수는 빨간 테두리 대상 카드 수와 동일한 공통 판정을 사용한다", () => {
  const cards = [card({ id: "normal" }), card({ id: "one", pendingMemoCount: 1 }), card({ id: "many", pendingMemoCount: 3 }), card({ id: "conflict", status: "CONFLICT", pendingMemoCount: 2 })];
  const summary = summarizeRoomOverview(cards);
  assert.equal(summary.operationalStatuses.INSPECTION_REQUIRED, cards.filter(requiresRoomInspection).length);
  assert.equal(summary.operationalStatuses.INSPECTION_REQUIRED, 3);
});

test("PC와 모바일 객실 카드는 공통 테마의 Header·Body·Badge·아이콘을 사용한다", () => {
  const desktopCard = readFileSync("src/features/room-overview/components/room-overview-card.tsx", "utf8");
  const desktopHeader = readFileSync("src/features/room-overview/components/room-overview-status-header.tsx", "utf8");
  const mobileCard = readFileSync("src/features/room-overview/components/compact-room-status-card.tsx", "utf8");

  assert.match(desktopCard, /ROOM_STATUS_THEME\[themeStatus\]/);
  assert.match(desktopCard, /getZonedDateInput\(reservation\.startDate\)/);
  assert.doesNotMatch(desktopCard, /startDate\.toISOString\(\)\.slice/);
  assert.match(desktopCard, /theme\.bodyClass/);
  assert.match(desktopHeader, /theme\.headerClass/);
  assert.match(desktopHeader, /theme\.icon/);
  assert.match(mobileCard, /status\.headerClass/);
  assert.match(mobileCard, /status\.bodyClass/);
  assert.match(mobileCard, /status\.badgeClass/);
  assert.match(mobileCard, /status\.icon/);
});

test("모바일 조회 날짜는 잘못된 값을 거부하고 하루씩 이동한다", () => {
  assert.equal(parseRoomOverviewDateKey("2026-07-27", "2026-01-01"), "2026-07-27");
  assert.equal(parseRoomOverviewDateKey("2026-02-30", "2026-01-01"), "2026-01-01");
  assert.equal(moveRoomOverviewDate("2026-07-31", 1), "2026-08-01");
  assert.equal(moveRoomOverviewDate("2026-01-01", -1), "2025-12-31");
});

test("모바일 상태 요약은 예약·공실·체크인·체크아웃과 청소중을 계산한다", () => {
  const summary = summarizeMobileRooms([
    card({ id: "vacant", status: "VACANT" }),
    card({ id: "reserved", status: "OCCUPIED" }),
    card({ id: "conflict", status: "CONFLICT" }),
    card({ id: "check-in", status: "CHECK_IN_TODAY" }),
    card({ id: "check-out", status: "CHECK_OUT_TODAY", operationalStatus: "CLEANING_REQUIRED" }),
  ]);
  assert.deepEqual(summary, { total: 5, reserved: 2, vacant: 1, checkIn: 1, checkOut: 1, cleaning: 1, conflict: 1 });
});

test("모바일 캘린더 기간은 3·7·14·30일만 허용하고 선택 날짜를 중앙 기준으로 배치한다", () => {
  assert.equal(parseCalendarRangeDays("14"), 14);
  assert.equal(parseCalendarRangeDays("9"), 7);
  assert.equal(getCalendarRangeStart("2026-07-27", 7), "2026-07-24");
  assert.deepEqual(buildCalendarDateRange("2026-07-27", 3), ["2026-07-26", "2026-07-27", "2026-07-28"]);
  assert.equal(buildCalendarDateRange("2026-07-27", 30).length, 30);
});

test("모바일 검색과 상태·OTA·동기화 필터를 함께 적용한다", () => {
  const rooms = [
    card({ id: "1", code: "501", name: "가르데니아", propertyName: "선샤인", status: "OCCUPIED", providers: ["AIRBNB"], syncStates: [{ provider: "AIRBNB", status: "FAILED", startedAt: todayStart, completedAt: todayEnd }] }),
    card({ id: "2", code: "502", name: "라벤더", propertyName: "문라이트", status: "VACANT" }),
  ];
  assert.deepEqual(filterMobileRooms(rooms, { query: "선샤인", status: "RESERVED", ota: "CONNECTED", sync: "ERROR" }).map((room) => room.id), ["1"]);
  assert.deepEqual(filterMobileRooms(rooms, { query: "502", status: "VACANT", ota: "DISCONNECTED", sync: "NORMAL" }).map((room) => room.id), ["2"]);
});

test("모바일 목록 정렬은 객실·숙소·상태·체크인·체크아웃 기준을 지원한다", () => {
  const late = reservation({ id: "late", startDate: new Date("2026-07-28T00:00:00+09:00"), endDate: new Date("2026-07-30T00:00:00+09:00") });
  const early = reservation({ id: "early", startDate: new Date("2026-07-25T00:00:00+09:00"), endDate: new Date("2026-07-26T00:00:00+09:00") });
  const rooms = [card({ id: "2", name: "502호", propertyName: "B", nextReservation: late }), card({ id: "1", name: "301호", propertyName: "A", nextReservation: early })];
  assert.deepEqual(sortMobileRooms(rooms, "room", "asc").map((room) => room.id), ["1", "2"]);
  assert.deepEqual(sortMobileRooms(rooms, "property", "desc").map((room) => room.id), ["2", "1"]);
  assert.deepEqual(sortMobileRooms(rooms, "checkIn", "asc").map((room) => room.id), ["1", "2"]);
  assert.deepEqual(sortMobileRooms(rooms, "checkOut", "desc").map((room) => room.id), ["2", "1"]);
});

test("7일 모바일 캘린더는 예약을 범위에 맞춰 자르고 취소·차단 예약을 제외한다", () => {
  const peer = { conflictId: "conflict-1", reservationId: "peer", guestName: null, provider: "BOOKING" as const, startDate: new Date("2026-07-26T00:00:00+09:00"), endDate: new Date("2026-07-28T00:00:00+09:00") };
  const room = card({
    activeConflictCount: 1,
    reservations: [
      reservation({ id: "visible", startDate: new Date("2026-07-25T00:00:00+09:00"), endDate: new Date("2026-07-29T00:00:00+09:00"), activeConflicts: [peer] }),
      reservation({ id: "cancelled", status: "CANCELLED", startDate: new Date("2026-07-27T00:00:00+09:00"), endDate: new Date("2026-07-28T00:00:00+09:00") }),
    ],
  });
  const segments = buildMobileRoomCalendarSegments(room, "2026-07-27", 7);
  assert.equal(segments.length, 1);
  assert.deepEqual({ id: segments[0].id, leftDays: segments[0].leftDays, durationDays: segments[0].durationDays, hasConflict: segments[0].hasConflict }, { id: "visible", leftDays: 0, durationDays: 2, hasConflict: true });
});

test("객실에 다른 충돌이 있어도 실제 충돌 상대가 없는 예약 막대는 빨갛게 표시하지 않는다", () => {
  const peer = { conflictId: "conflict-1", reservationId: "peer", guestName: null, provider: "AGODA" as const, startDate: new Date("2026-07-28T00:00:00+09:00"), endDate: new Date("2026-07-31T00:00:00+09:00") };
  const segments = buildMobileRoomCalendarSegments(card({
    activeConflictCount: 1,
    reservations: [
      reservation({ id: "normal", startDate: new Date("2026-07-27T00:00:00+09:00"), endDate: new Date("2026-07-28T00:00:00+09:00") }),
      reservation({ id: "conflicting", startDate: new Date("2026-07-28T00:00:00+09:00"), endDate: new Date("2026-08-01T00:00:00+09:00"), activeConflicts: [peer] }),
    ],
  }), "2026-07-27", 7);
  assert.deepEqual(segments.map(({ id, hasConflict }) => ({ id, hasConflict })), [
    { id: "normal", hasConflict: false },
    { id: "conflicting", hasConflict: true },
  ]);
});

test("모바일 타임라인은 체크아웃 날짜를 숙박 막대에 포함하지 않는다", () => {
  const segments = buildMobileRoomCalendarSegments(card({ reservations: [reservation({ startDate: new Date("2026-07-27T00:00:00+09:00"), endDate: new Date("2026-07-28T00:00:00+09:00") })] }), "2026-07-27", 7);
  assert.equal(segments[0].durationDays, 1);
  assert.equal(segments[0].endsInRange, true);
});

test("겹치는 예약은 서로 다른 타임라인 레인에 배치한다", () => {
  const segments = buildMobileRoomCalendarSegments(card({ reservations: [
    reservation({ id: "one", startDate: new Date("2026-07-27T00:00:00+09:00"), endDate: new Date("2026-07-30T00:00:00+09:00") }),
    reservation({ id: "two", startDate: new Date("2026-07-28T00:00:00+09:00"), endDate: new Date("2026-07-31T00:00:00+09:00") }),
  ] }), "2026-07-27", 7);
  assert.deepEqual(segments.map((segment) => segment.lane), [0, 1]);
  assert.deepEqual(segments.map((segment) => segment.laneCount), [2, 2]);
});

test("객실 타임라인은 숙소별로 그룹화하고 범위 내 예약과 오버부킹을 집계한다", () => {
  const groups = groupRoomsForCalendar([
    card({ id: "a", propertyId: "p1", propertyName: "가르데니아", reservations: [reservation({ startDate: new Date("2026-07-27T00:00:00+09:00"), endDate: new Date("2026-07-29T00:00:00+09:00") })] }),
    card({ id: "b", propertyId: "p1", propertyName: "가르데니아", activeConflictCount: 1 }),
    card({ id: "c", propertyId: "p2", propertyName: "세레니티" }),
  ], "2026-07-27", 7);
  assert.deepEqual(groups.map(({ label, roomCount, reservationCount, conflictCount }) => ({ label, roomCount, reservationCount, conflictCount })), [
    { label: "가르데니아", roomCount: 2, reservationCount: 1, conflictCount: 1 },
    { label: "세레니티", roomCount: 1, reservationCount: 0, conflictCount: 0 },
  ]);
});

test("모바일 객실 현황은 2열 카드·3가지 보기·하단 안전 영역을 제공한다", () => {
  const cardGrid = readFileSync("src/features/room-overview/components/room-status-card-grid.tsx", "utf8");
  const toolbar = readFileSync("src/features/room-overview/components/room-status-mobile-toolbar.tsx", "utf8");
  const detailSheet = readFileSync("src/features/room-overview/components/room-detail-sheet.tsx", "utf8");
  const timeline = readFileSync("src/features/room-overview/components/room-status-calendar.tsx", "utf8");
  const reservationSheet = readFileSync("src/features/room-overview/components/reservation-detail-sheet.tsx", "utf8");
  assert.match(cardGrid, /grid-cols-2/);
  assert.match(toolbar, /value: "card"/);
  assert.match(toolbar, /value: "list"/);
  assert.match(toolbar, /value: "calendar"/);
  assert.match(detailSheet, /safe-area-inset-bottom/);
  assert.match(timeline, /TimelineDateHeader/);
  assert.match(timeline, /todayIndex/);
  assert.match(timeline, /overflow-auto/);
  assert.match(reservationSheet, /side="bottom"/);
});

test("모바일 타임라인은 좁은 객실 열과 간결한 OTA·공실 표시를 사용한다", () => {
  const domain = readFileSync("src/features/room-overview/domain/room-overview-mobile.ts", "utf8");
  const roomRow = readFileSync("src/features/room-overview/components/timeline-room-row.tsx", "utf8");
  const reservationBar = readFileSync("src/features/room-overview/components/timeline-reservation-bar.tsx", "utf8");
  const dateHeader = readFileSync("src/features/room-overview/components/timeline-date-header.tsx", "utf8");
  const calendar = readFileSync("src/features/room-overview/components/room-status-calendar.tsx", "utf8");
  const collapsedGroups = readFileSync("src/features/room-overview/hooks/use-collapsed-room-groups.ts", "utf8");

  assert.match(domain, /TIMELINE_ROOM_COLUMN_WIDTH = 132/);
  assert.match(domain, /TIMELINE_ROW_MIN_HEIGHT = 44/);
  assert.match(roomRow, /getProviderLabel/);
  assert.match(roomRow, /formatRoomDisplayLabel/);
  assert.match(roomRow, /formatRoomNumber/);
  assert.match(roomRow, /className="shrink-0"/);
  assert.match(roomRow, /ROOM_STATUS_THEME\.VACANT\.badgeClass/);
  assert.equal(roomRow.match(/room\.propertyName/g)?.length, 1);
  assert.doesNotMatch(roomRow, /guestName/);
  assert.match(reservationBar, /rounded-full/);
  assert.match(reservationBar, /visual\.className/);
  assert.doesNotMatch(reservationBar, /LogIn|LogOut|startsInRange|endsInRange/);
  assert.match(dateHeader, /MOBILE_TIMELINE_TODAY_VISUAL\.badgeClassName/);
  assert.match(calendar, /MOBILE_TIMELINE_TODAY_VISUAL\.lineClassName/);
  assert.match(collapsedGroups, /useState<Set<string>>\(\(\) => new Set\(\)\)/);
});

test("객실 현황 select 필터는 기존 URL 조건을 유지하며 즉시 병합한다", () => {
  let params = new URLSearchParams("query=301&date=2026-09-18");
  params = updateRoomOverviewFilterParams(params, "status", "CHECK_OUT_TODAY");
  params = updateRoomOverviewFilterParams(params, "provider", "AIRBNB");
  params = updateRoomOverviewFilterParams(params, "propertyId", "centercoz");
  params = updateRoomOverviewFilterParams(params, "operationalStatus", "INSPECTION_REQUIRED");
  params = updateRoomOverviewFilterParams(params, "syncStatus", "FAILED");
  assert.deepEqual(Object.fromEntries(params), {
    query: "301",
    date: "2026-09-18",
    status: "CHECK_OUT_TODAY",
    provider: "AIRBNB",
    propertyId: "centercoz",
    operationalStatus: "INSPECTION_REQUIRED",
    syncStatus: "FAILED",
  });
});

test("select 기본값 복원은 해당 query만 제거하고 최신 연속 조건을 보존한다", () => {
  let params = new URLSearchParams("status=CHECK_OUT_TODAY&provider=AIRBNB&propertyId=centercoz");
  params = updateRoomOverviewFilterParams(params, "status", "VACANT");
  params = updateRoomOverviewFilterParams(params, "provider", "BOOKING");
  params = updateRoomOverviewFilterParams(params, "status", "");
  assert.equal(params.has("status"), false);
  assert.equal(params.get("provider"), "BOOKING");
  assert.equal(params.get("propertyId"), "centercoz");
});

test("PC select는 즉시 replace하고 검색어만 조회 또는 Enter 제출을 기다린다", () => {
  const form = readFileSync("src/features/room-overview/components/room-overview-filter-form.tsx", "utf8");
  const toolbar = readFileSync("src/features/room-overview/components/room-overview-toolbar.tsx", "utf8");
  assert.match(form, /onChange=\{\(event\) => replaceFilter\("status"/);
  assert.match(form, /onChange=\{\(event\) => replaceFilter\("provider"/);
  assert.match(form, /onChange=\{\(event\) => replaceFilter\("propertyId"/);
  assert.match(form, /onChange=\{\(event\) => replaceFilter\("operationalStatus"/);
  assert.match(form, /router\.replace\([\s\S]*\{ scroll: false \}\)/);
  assert.match(form, /onSubmit=\{submitSearch\}/);
  assert.match(form, /roomOverviewFilters\.searchButton/);
  assert.doesNotMatch(toolbar, /auto\.m0087|method="get"/);
});

test("모바일 Sheet select는 draft 없이 즉시 적용하고 초기화도 즉시 실행한다", () => {
  const sheet = readFileSync("src/features/room-overview/components/room-status-filter-sheet.tsx", "utf8");
  const hook = readFileSync("src/features/room-overview/hooks/use-room-status-filters.ts", "utf8");
  assert.doesNotMatch(sheet, /\[draft, setDraft\]/);
  assert.match(sheet, /applySelect\("status"/);
  assert.match(sheet, /applySelect\("ota"/);
  assert.match(sheet, /applySelect\("sync"/);
  assert.match(sheet, /onApply\(filters, nextPropertyId \|\| undefined\)/);
  assert.match(sheet, /onReset\(\)/);
  assert.match(hook, /resetFilters[\s\S]*applyFilters\(next, undefined\)/);
});

test("PC 객실 현황은 개발자 UI 설정 CSS 변수를 모든 노출 항목에 연결한다", () => {
  const page = readFileSync("src/app/room-overview/page.tsx", "utf8");
  const card = readFileSync("src/features/room-overview/components/room-overview-card.tsx", "utf8");
  const statusHeader = readFileSync("src/features/room-overview/components/room-overview-status-header.tsx", "utf8");
  const providerBadges = readFileSync("src/features/room-overview/components/room-overview-provider-badges.tsx", "utf8");
  const layout = readFileSync("src/features/room-overview/components/room-overview-visuals.module.css", "utf8");

  assert.match(page, /enabled=\{context\?\.actualRole === "DEVELOPER"\}/);
  assert.match(card, /styles\.roomCard/);
  assert.match(card, /styles\.roomCardSection/);
  assert.match(card, /styles\.propertyName/);
  assert.match(card, /styles\.roomName/);
  assert.match(statusHeader, /styles\.statusBar/);
  assert.match(providerBadges, /styles\.providerBadge/);
  assert.match(layout, /var\(--room-card-min-width/);
  assert.match(layout, /var\(--room-card-min-height/);
  assert.match(layout, /var\(--room-grid-gap/);
  assert.match(layout, /var\(--room-card-padding/);
  assert.match(layout, /var\(--room-status-bar-height/);
  assert.match(layout, /var\(--room-property-font-size/);
  assert.match(layout, /var\(--room-name-font-size/);
  assert.match(layout, /var\(--room-schedule-panel-width/);
  assert.match(layout, /var\(--room-provider-badge-height/);
  assert.match(layout, /var\(--room-provider-badge-padding/);
  assert.match(layout, /var\(--room-provider-badge-font-size/);
  assert.doesNotMatch(layout, /minmax\(min\(100%, 270px\)/);
  assert.doesNotMatch(page, /grid items-start gap-2/);
});
