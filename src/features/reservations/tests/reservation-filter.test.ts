import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { reservationDateHref, reservationDateRangeLabel, shiftReservationDateInput } from "../reservation-query";
import { getReservationFilterCount } from "../reservation-filter-count";
import { EMPTY_RESERVATION_FILTERS, parseReservationFilters, serializeReservationFilters } from "../reservation-filter-query";
import { getReservationDatePresetRange } from "../reservation-date-presets";
import { buildReservationListDateWhere } from "../reservation-list-date-where";
import { applyQuickReservationFilter } from "../reservation-quick-filters";
import {
  applyReservationDateNavigationToFilters,
  formatReservationNavigationDate,
  getNextReservationDate,
  getPreviousReservationDate,
  getReservationRelativeDate,
  parseReservationDateNavigation,
  reservationDateNavigationHref,
} from "../reservation-date-navigation";

const TOKYO_NOW = new Date("2026-08-14T12:00:00+09:00");

type DateRangeFilter = { gte?: Date; gt?: Date; lt?: Date; lte?: Date };

function matchesDateFilter(value: Date, filter: DateRangeFilter | undefined): boolean {
  if (!filter) return true;
  return (filter.gte === undefined || value >= filter.gte)
    && (filter.gt === undefined || value > filter.gt)
    && (filter.lt === undefined || value < filter.lt)
    && (filter.lte === undefined || value <= filter.lte);
}

function matchesReservationListDateWhere(
  where: ReturnType<typeof buildReservationListDateWhere>,
  reservation: { startDate: Date; endDate: Date },
): boolean {
  return matchesDateFilter(reservation.startDate, where.startDate as DateRangeFilter | undefined)
    && matchesDateFilter(reservation.endDate, where.endDate as DateRangeFilter | undefined);
}

const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const HISTORICAL_RANGE = {
  from: utcDate("2026-08-01"),
  toExclusive: utcDate("2026-08-25"),
};

test("체크아웃 날짜 탐색은 Asia/Tokyo의 오늘을 기준으로 URL 상태를 만든다", () => {
  const navigation = parseReservationDateNavigation(
    new URLSearchParams({ mode: "checkout", date: "2026-08-14" }),
    TOKYO_NOW,
  );
  assert.ok(navigation);
  assert.equal(navigation.mode, "checkout");
  assert.equal(navigation.today, "2026-08-14");
  assert.equal(navigation.selectedDate, "2026-08-14");
  assert.equal(navigation.rangeStart.toISOString(), "2026-08-13T15:00:00.000Z");
  assert.equal(navigation.rangeEnd.toISOString(), "2026-08-14T15:00:00.000Z");
});

test("날짜가 없거나 잘못되면 체크아웃 모드는 실제 오늘로 안전하게 복구한다", () => {
  assert.equal(
    parseReservationDateNavigation(new URLSearchParams({ mode: "checkout" }), TOKYO_NOW)?.selectedDate,
    "2026-08-14",
  );
  assert.equal(
    parseReservationDateNavigation(new URLSearchParams({ mode: "checkout", date: "2026-99-99" }), TOKYO_NOW)?.selectedDate,
    "2026-08-14",
  );
  assert.equal(parseReservationDateNavigation(new URLSearchParams({ mode: "invalid" }), TOKYO_NOW), null);
});

test("어제·오늘·내일과 화살표는 고정된 오늘과 현재 선택일을 각각 기준으로 이동한다", () => {
  const today = "2026-08-14";
  assert.equal(getPreviousReservationDate(today), "2026-08-13");
  assert.equal(getNextReservationDate(today), "2026-08-15");
  assert.equal(getNextReservationDate("2026-08-15"), "2026-08-16");
  assert.equal(getNextReservationDate("2026-08-16"), "2026-08-17");
  assert.equal(getPreviousReservationDate("2026-08-13"), "2026-08-12");
  assert.equal(getReservationRelativeDate("2026-08-13", today), "yesterday");
  assert.equal(getReservationRelativeDate("2026-08-14", today), "today");
  assert.equal(getReservationRelativeDate("2026-08-15", today), "tomorrow");
  assert.equal(getReservationRelativeDate("2026-08-17", today), "other");
});

test("체크아웃 날짜 URL은 기존 필터를 유지하고 충돌하는 날짜 필터와 페이지를 제거한다", () => {
  const query = new URLSearchParams({
    propertyId: "property-a",
    roomId: "room-a",
    provider: "AIRBNB,BOOKING,AGODA",
    search: "908",
    dateField: "stay",
    from: "2026-08-01",
    to: "2026-08-31",
    page: "3",
  });
  const url = new URL(reservationDateNavigationHref(query, "checkout", "2026-08-15"), "https://stayboard.test");
  assert.equal(url.searchParams.get("mode"), "checkout");
  assert.equal(url.searchParams.get("date"), "2026-08-15");
  assert.equal(url.searchParams.get("propertyId"), "property-a");
  assert.equal(url.searchParams.get("roomId"), "room-a");
  assert.equal(url.searchParams.get("provider"), "AIRBNB,BOOKING,AGODA");
  assert.equal(url.searchParams.get("search"), "908");
  assert.equal(url.searchParams.has("dateField"), false);
  assert.equal(url.searchParams.has("from"), false);
  assert.equal(url.searchParams.has("to"), false);
  assert.equal(url.searchParams.has("page"), false);
});

test("날짜 탐색 모드는 기존 필터를 유지하면서 서버 조회 필드만 선택 날짜로 정규화한다", () => {
  const navigation = parseReservationDateNavigation(
    new URLSearchParams({ mode: "checkout", date: "2026-08-13" }),
    TOKYO_NOW,
  );
  const filters = applyReservationDateNavigationToFilters({
    ...EMPTY_RESERVATION_FILTERS,
    propertyId: "property-a",
    providers: ["AIRBNB", "BOOKING", "AGODA"],
  }, navigation);
  assert.equal(filters.dateField, "checkOut");
  assert.equal(filters.from, "2026-08-13");
  assert.equal(filters.to, "2026-08-13");
  assert.equal(filters.propertyId, "property-a");
  assert.deepEqual(filters.providers, ["AIRBNB", "BOOKING", "AGODA"]);
});

test("선택 날짜 표시는 한국어와 일본어 요일을 안정적으로 포맷한다", () => {
  assert.equal(formatReservationNavigationDate("2026-08-14", "ko"), "2026.08.14 (금)");
  assert.equal(formatReservationNavigationDate("2026-08-14", "ja"), "2026.08.14 (金)");
});

test("체크아웃 전용 날짜 탐색도 예약 목록의 공통 날짜 정책을 사용한다", () => {
  const listWhere = readFileSync("src/features/reservations/reservation-list-where.ts", "utf8");
  const dashboard = readFileSync("src/app/page.tsx", "utf8");
  assert.match(listWhere, /buildReservationListDateWhere\(filters\)/);
  assert.match(dashboard, /\/reservations\?mode=checkout&date=\$\{today\}/);
});

test("숙박 기간 조회는 오늘이 2026-08-28이어도 선택 기간과 겹치는 과거·경계 예약을 모두 포함한다", () => {
  const where = buildReservationListDateWhere({
    dateField: "stay",
    ...HISTORICAL_RANGE,
  });
  assert.deepEqual(where, {
    startDate: { lt: HISTORICAL_RANGE.toExclusive },
    endDate: { gt: HISTORICAL_RANGE.from },
  });
  for (const reservation of [
    { startDate: utcDate("2026-08-01"), endDate: utcDate("2026-08-05") },
    { startDate: utcDate("2026-07-30"), endDate: utcDate("2026-08-03") },
    { startDate: utcDate("2026-08-20"), endDate: utcDate("2026-08-30") },
  ]) {
    assert.equal(matchesReservationListDateWhere(where, reservation), true);
  }
  assert.equal(matchesReservationListDateWhere(where, {
    startDate: utcDate("2026-07-30"),
    endDate: HISTORICAL_RANGE.from,
  }), false);
  assert.equal(matchesReservationListDateWhere(where, {
    startDate: HISTORICAL_RANGE.toExclusive,
    endDate: utcDate("2026-08-30"),
  }), false);
});

test("체크인 기준은 startDate가 선택 범위 안에 있을 때만 포함한다", () => {
  const where = buildReservationListDateWhere({
    dateField: "checkIn",
    ...HISTORICAL_RANGE,
  });
  assert.deepEqual(where, {
    startDate: { gte: HISTORICAL_RANGE.from, lt: HISTORICAL_RANGE.toExclusive },
  });
  assert.equal(matchesReservationListDateWhere(where, {
    startDate: utcDate("2026-07-30"),
    endDate: utcDate("2026-08-03"),
  }), false);
  assert.equal(matchesReservationListDateWhere(where, {
    startDate: HISTORICAL_RANGE.from,
    endDate: utcDate("2026-08-03"),
  }), true);
});

test("체크아웃 기준은 from 초과, toExclusive 이하 경계를 적용한다", () => {
  const where = buildReservationListDateWhere({
    dateField: "checkOut",
    ...HISTORICAL_RANGE,
  });
  assert.deepEqual(where, {
    endDate: { gt: HISTORICAL_RANGE.from, lte: HISTORICAL_RANGE.toExclusive },
  });
  assert.equal(matchesReservationListDateWhere(where, {
    startDate: utcDate("2026-07-30"),
    endDate: utcDate("2026-08-03"),
  }), true);
  assert.equal(matchesReservationListDateWhere(where, {
    startDate: utcDate("2026-07-30"),
    endDate: HISTORICAL_RANGE.from,
  }), false);
  assert.equal(matchesReservationListDateWhere(where, {
    startDate: utcDate("2026-08-20"),
    endDate: HISTORICAL_RANGE.toExclusive,
  }), true);
});

test("날짜 탐색 mode는 남아 있는 일반 날짜 필드보다 우선한다", () => {
  assert.deepEqual(buildReservationListDateWhere({
    dateMode: "checkin",
    dateField: "checkOut",
    ...HISTORICAL_RANGE,
  }), {
    startDate: { gte: HISTORICAL_RANGE.from, lt: HISTORICAL_RANGE.toExclusive },
  });
  assert.deepEqual(buildReservationListDateWhere({
    dateMode: "checkout",
    dateField: "checkIn",
    ...HISTORICAL_RANGE,
  }), {
    endDate: { gt: HISTORICAL_RANGE.from, lte: HISTORICAL_RANGE.toExclusive },
  });
});

test("날짜 이동은 날짜와 URL을 갱신하고 다른 필터를 유지한다", () => {
  const query = new URLSearchParams({ propertyId: "property-a", roomId: "room-a", provider: "AIRBNB", status: "UPCOMING", dateField: "checkOut", from: "2026-07-25", to: "2026-07-25", page: "3" });
  const from = shiftReservationDateInput("2026-07-25", -1);
  const to = shiftReservationDateInput("2026-07-25", -1);
  const href = reservationDateHref(query, from, to);
  const result = new URL(href, "https://stayboard.test");
  assert.equal(result.searchParams.get("from"), "2026-07-24");
  assert.equal(result.searchParams.get("to"), "2026-07-24");
  assert.equal(result.searchParams.get("propertyId"), "property-a");
  assert.equal(result.searchParams.get("roomId"), "room-a");
  assert.equal(result.searchParams.get("provider"), "AIRBNB");
  assert.equal(result.searchParams.get("status"), "UPCOMING");
  assert.equal(result.searchParams.get("dateField"), "checkOut");
  assert.equal(result.searchParams.has("page"), false);
});

test("현재 조회 날짜는 단일 날짜와 범위를 구분해 표시한다", () => {
  assert.equal(reservationDateRangeLabel("2026-07-26", "2026-07-26"), "2026년 7월 26일 (일)");
  assert.equal(reservationDateRangeLabel("2026-07-26", "2026-07-30"), "2026년 7월 26일 ~ 2026년 7월 30일");
});

test("Booking provider는 예약 목록·객실 현황·월간 캘린더 조회 대상에 포함된다", () => {
  const policy = readFileSync("src/features/reservations/operational-reservation-where.ts", "utf8");
  assert.match(policy, /CALENDAR_PROVIDER_TYPES/);
  for (const path of [
    "src/features/reservations/reservation.repository.ts",
    "src/features/room-overview/infrastructure/room-overview.repository.ts",
    "src/features/room-status/room-status.repository.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /buildOperationalReservationWhere/);
  }
  assert.match(readFileSync("src/providers/calendar/types.ts", "utf8"), /"BOOKING"/);
});

test("URL 예약 필터는 다중 OTA·상태를 안전하게 파싱하고 직렬화한다", () => {
  const parsed = parseReservationFilters(new URLSearchParams({
    search: " 701 ",
    provider: "AIRBNB,INVALID,AGODA,AIRBNB",
    status: "UPCOMING,CANCELLED,PAST,CONFIRMED",
    dateField: "checkIn",
    from: "2026-06-27",
    to: "2026-07-23",
    conflict: "true",
  }));
  assert.deepEqual(parsed.providers, ["AIRBNB", "AGODA"]);
  assert.deepEqual(parsed.statuses, ["UPCOMING"]);
  assert.equal(parsed.search, "701");
  assert.equal(parsed.hasConflict, true);
  assert.equal(serializeReservationFilters(parsed).get("provider"), "AIRBNB,AGODA");
  assert.equal(serializeReservationFilters(parsed).has("page"), false);
});

test("URL에서 과거·취소 상태를 직접 요청해도 활성 상태 필터로 인정하지 않는다", () => {
  const parsed = parseReservationFilters(new URLSearchParams({
    status: "PAST,CANCELLED",
    from: "2026-01-01",
    to: "2026-01-31",
  }));
  assert.deepEqual(parsed.statuses, []);
  assert.equal(parsed.from, "2026-01-01");
  assert.equal(parsed.to, "2026-01-31");
});

test("잘못된 URL 날짜와 필터 값은 기본값으로 복구한다", () => {
  const parsed = parseReservationFilters(new URLSearchParams({ from: "not-a-date", to: "2026-99-99", dateField: "invalid", conflict: "unknown" }));
  assert.deepEqual(parsed, EMPTY_RESERVATION_FILTERS);
});

test("필터 개수는 검색어를 제외하고 실제 선택 항목을 센다", () => {
  assert.equal(getReservationFilterCount({ ...EMPTY_RESERVATION_FILTERS, search: "Kim", providers: ["AIRBNB", "AGODA"], statuses: ["STAYING"], hasConflict: true }), 4);
});

test("빠른 날짜 필터는 일본 표준시 기준의 순수 함수로 계산한다", () => {
  const now = new Date("2026-07-27T00:30:00+09:00");
  assert.deepEqual(getReservationDatePresetRange("today", now), { from: "2026-07-27", to: "2026-07-27" });
  assert.deepEqual(getReservationDatePresetRange("this-week", now), { from: "2026-07-27", to: "2026-08-02" });
  const filtered = applyQuickReservationFilter(EMPTY_RESERVATION_FILTERS, "today-check-out", now);
  assert.equal(filtered.dateField, "checkOut");
  assert.equal(filtered.from, "2026-07-27");
  assert.deepEqual(getReservationDatePresetRange("this-month", new Date("2026-08-31T23:30:00+09:00")), { from: "2026-08-01", to: "2026-08-31" });
});

test("예약 상태와 빠른 필터 UI에는 운영 중인 예약 조건만 노출한다", () => {
  const filterFields = readFileSync("src/features/reservations/components/reservation-filter-fields.tsx", "utf8");
  const quickFilters = readFileSync("src/features/reservations/components/reservation-quick-filter-sheet.tsx", "utf8");
  assert.match(filterFields, /ACTIVE_RESERVATION_DISPLAY_STATUSES/);
  assert.match(filterFields, /getLocalizedReservationStatusLabel/);
  assert.match(filterFields, /i18n\("auto\.m0102"\)/);
  assert.match(quickFilters, /i18n\("reservation\.statuses\.CHECK_IN_TODAY"\)/);
  assert.match(quickFilters, /i18n\("reservation\.statuses\.CHECK_OUT_TODAY"\)/);
  assert.match(quickFilters, /i18n\("auto\.m0387"\)/);
  assert.match(quickFilters, /value: "month-stays"/);
  assert.doesNotMatch(filterFields, /지난 예약|취소됨|노쇼/);
  assert.doesNotMatch(quickFilters, /취소된 예약|지난 예약|과거 예약|노쇼/);
});

test("목록과 결과 개수는 동일한 활성 예약 서버 조건을 사용한다", () => {
  const repository = readFileSync("src/features/reservations/reservation.repository.ts", "utf8");
  const activeWhere = readFileSync("src/features/reservations/active-reservation-where.ts", "utf8");
  const listWhere = readFileSync("src/features/reservations/reservation-list-where.ts", "utf8");
  const operationalWhere = readFileSync("src/features/reservations/operational-reservation-where.ts", "utf8");
  assert.match(repository, /const where = buildReservationListWhere\(filters\)/);
  assert.match(repository, /prisma\.reservation\.count\(\{ where \}\)/);
  assert.match(listWhere, /buildOperationalReservationWhere/);
  assert.match(listWhere, /buildScopedReservationHistoryWhere/);
  assert.match(operationalWhere, /status: \{ in: \[\.\.\.ACTIVE_OTA_RESERVATION_STATUSES\] \}/);
  assert.match(activeWhere, /endDate: \{ gt: start \}/);
  assert.match(operationalWhere, /calendarSource: \{ is: \{ isActive: true \} \}/);
  assert.match(operationalWhere, /provider: \{ in: \[\.\.\.CALENDAR_PROVIDER_TYPES\] \}/);
  assert.match(operationalWhere, /room:[\s\S]*isActive: true,[\s\S]*property: \{ isActive: true, company: \{ isActive: true \} \}/);
  assert.match(listWhere, /\.\.\.\(filters\.propertyId \? \{ propertyId: filters\.propertyId \} : \{\}\)/);
  assert.match(listWhere, /\.\.\.\(filters\.roomId \? \{ roomId: filters\.roomId \} : \{\}\)/);
  assert.doesNotMatch(listWhere, /businessDateStart|endDateStart|laterDate/);
  assert.doesNotMatch(listWhere, /endDate: \{ gt: start \}/);
  assert.doesNotMatch(listWhere, /property: filters\.companyIds/);
});

test("예약 이력 목록 정책은 대시보드·객실 현황·청소 운영 쿼리로 유입되지 않는다", () => {
  for (const path of [
    "src/features/room-overview/infrastructure/room-overview.repository.ts",
    "src/features/room-status/room-status.repository.ts",
    "src/features/cleaning/server/cleaning-task-query.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /buildOperationalReservationWhere/);
    assert.doesNotMatch(source, /buildReservationListWhere/);
  }
});

test("존재하지 않는 현재성 필드 대신 완전 파싱·관찰 UID로 source 예약을 reconciliation 한다", () => {
  const paths = [
    "prisma/schema.prisma",
    "src/features/reservations/active-reservation-where.ts",
    "src/features/reservation-conflicts/infrastructure/reservation-conflict.repository.ts",
    "src/features/calendar-sync/infrastructure/reservation-sync.repository.ts",
  ];
  for (const path of paths) assert.doesNotMatch(readFileSync(path, "utf8"), /isCurrentCalendarEntry/);
  const syncSource = readFileSync(paths[3], "utf8");
  const conflictRepository = readFileSync(paths[2], "utf8");
  const classificationSource = readFileSync("src/features/calendar-sync/domain/classify-reservations.ts", "utf8");
  assert.match(conflictRepository, /buildOperationalReservationWhere\(\)/);
  assert.match(syncSource, /classification\.missingDeletionIds/);
  assert.match(syncSource, /UPDATE "Reservation" AS reservation/);
  assert.doesNotMatch(syncSource, /for \(const item of classification\.update\)/);
  assert.match(syncSource, /fullyParsed: input\.fullyParsed/);
  assert.match(classificationSource, /reconciliation\.observedUids\.has\(reservation\.rawUid\)/);
  assert.match(classificationSource, /result\.missingDeletionIds\.push\(reservation\.id\)/);
});
