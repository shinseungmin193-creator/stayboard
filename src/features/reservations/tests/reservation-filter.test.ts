import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { reservationDateHref, reservationDateRangeLabel, shiftReservationDateInput } from "../reservation-query";
import { getReservationFilterCount } from "../reservation-filter-count";
import { EMPTY_RESERVATION_FILTERS, parseReservationFilters, serializeReservationFilters } from "../reservation-filter-query";
import { getReservationDatePresetRange } from "../reservation-date-presets";
import { applyQuickReservationFilter } from "../reservation-quick-filters";

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
  assert.match(repository, /const where = buildActiveReservationWhere\(filters\)/);
  assert.match(repository, /prisma\.reservation\.count\(\{ where \}\)/);
  assert.match(activeWhere, /status: \{ in: \[\.\.\.ACTIVE_OTA_RESERVATION_STATUSES\] \}/);
  assert.match(activeWhere, /endDate: \{ gte: start \}/);
  assert.match(activeWhere, /calendarSource: \{ is: \{ isActive: true \} \}/);
  assert.match(activeWhere, /\.\.\.\(filters\.propertyId \? \{ propertyId: filters\.propertyId \} : \{\}\)/);
  assert.match(activeWhere, /\.\.\.\(filters\.roomId \? \{ roomId: filters\.roomId \} : \{\}\)/);
  assert.match(activeWhere, /const endDateStart = laterDate\(businessDateStart, requestedEndDateStart\)/);
  assert.doesNotMatch(activeWhere, /property: filters\.companyIds/);
});

test("존재하지 않는 캘린더 현재성 필드를 사용하지 않고 누락만으로 취소 처리하지 않는다", () => {
  const paths = [
    "prisma/schema.prisma",
    "src/features/reservations/active-reservation-where.ts",
    "src/features/reservation-conflicts/infrastructure/reservation-conflict.repository.ts",
    "src/features/calendar-sync/infrastructure/reservation-sync.repository.ts",
  ];
  for (const path of paths) assert.doesNotMatch(readFileSync(path, "utf8"), /isCurrentCalendarEntry/);
  const syncSource = readFileSync(paths[3], "utf8");
  assert.doesNotMatch(syncSource, /data: \{ status: "CANCELLED" \}/);
});
