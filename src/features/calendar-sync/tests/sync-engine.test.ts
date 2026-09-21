import test from "node:test";
import assert from "node:assert/strict";
import { parseIcsCalendar } from "../infrastructure/ics-parser";
import { AirbnbReservationNormalizer } from "../providers/airbnb-normalizer";
import { BookingReservationNormalizer } from "../providers/booking-normalizer";
import { AgodaReservationNormalizer } from "../providers/agoda-normalizer";
import { classifyReservations, reservationFieldsEqual } from "../domain/classify-reservations";
import type { ExistingReservation, NormalizedReservation } from "../domain/normalized-reservation";

const ics = (events: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}END:VCALENDAR\r\n`;
const validEvent = `BEGIN:VEVENT\r\nUID:one\r\nDTSTART;VALUE=DATE:20260721\r\nDTEND;VALUE=DATE:20260723\r\nSUMMARY:Reserved\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\n`;
const normalized = (overrides: Partial<NormalizedReservation> = {}): NormalizedReservation => ({ rawUid: "one", providerReservationId: "one", guestName: null, startDate: new Date("2026-07-21T00:00:00.000Z"), endDate: new Date("2026-07-23T00:00:00.000Z"), status: "CONFIRMED", summary: "Reserved", description: null, providerCreatedAt: null, providerUpdatedAt: null, ...overrides });
const existing = (overrides: Partial<ExistingReservation> = {}): ExistingReservation => ({ id: "existing", createdAt: new Date("2026-01-01T00:00:00.000Z"), ...normalized(), ...overrides });

test("VEVENT와 all-day 날짜를 Asia/Tokyo 자정으로 파싱한다", () => { const result = parseIcsCalendar(ics(validEvent)); assert.equal(result.totalEventCount, 1); assert.equal(result.events.length, 1); assert.equal(result.events[0].uid, "one"); assert.equal(result.events[0].startDate.toISOString(), "2026-07-20T15:00:00.000Z"); assert.equal(result.events[0].endDate.toISOString(), "2026-07-22T15:00:00.000Z"); });
test("잘못된 이벤트만 제외한다", () => { const invalid = `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260721\r\nDTEND;VALUE=DATE:20260720\r\nEND:VEVENT\r\n`; const result = parseIcsCalendar(ics(validEvent + invalid)); assert.equal(result.totalEventCount, 2); assert.equal(result.events.length, 1); assert.equal(result.excludedCount, 1); });
test("OTA Normalizer가 안정적인 UID와 상태를 보존한다", () => { const event = parseIcsCalendar(ics(validEvent)).events[0]; for (const normalizer of [new AirbnbReservationNormalizer(), new BookingReservationNormalizer(), new AgodaReservationNormalizer()]) { const result = normalizer.normalize(event); assert.equal(result?.rawUid, "one"); assert.equal(result?.providerReservationId, "one"); assert.equal(result?.status, "CONFIRMED"); assert.equal(result?.guestName, null); } });
test("Airbnb Normalizer가 예약과 차단 의미를 구분한다", () => {
  const reserved = parseIcsCalendar(ics(validEvent)).events[0];
  const blocked = parseIcsCalendar(ics(validEvent.replace("SUMMARY:Reserved", "SUMMARY:Airbnb (Not available)"))).events[0];
  const normalizer = new AirbnbReservationNormalizer();
  assert.deepEqual({ summary: normalizer.normalize(reserved)?.summary, status: normalizer.normalize(reserved)?.status }, { summary: "Airbnb", status: "CONFIRMED" });
  assert.equal(normalizer.classifyEvent(reserved), "RESERVATION");
  assert.equal(normalizer.classifyEvent(blocked), "BLOCKED");
});
test("신규·수정·동일 예약을 분류하고 검증 없는 누락 예약은 변경하지 않는다", () => { const current = existing(); const created = normalized({ rawUid: "new", providerReservationId: "new", summary: "New" }); const changed = normalized({ summary: "Changed" }); const missing = existing({ id: "missing", rawUid: "missing", providerReservationId: "missing" }); const same = existing({ id: "same", rawUid: "same", providerReservationId: "same" }); const incomingSame = normalized({ rawUid: "same", providerReservationId: "same" }); const result = classifyReservations([current, missing, same], [changed, created, incomingSame]); assert.equal(result.create.length, 1); assert.equal(result.update.length, 1); assert.equal(result.unchanged.length, 1); assert.equal(result.update.some((item) => item.id === missing.id), false); assert.deepEqual(result.staleCancellationIds, []); });
test("필드 변경과 CANCELLED 예약 재등장을 update로 분류한다", () => { assert.equal(reservationFieldsEqual(existing(), normalized({ summary: "Changed" })), false); const result = classifyReservations([existing({ status: "CANCELLED" })], [normalized({ status: "CONFIRMED" })]); assert.equal(result.update.length, 1); });
test("이미 취소된 누락 예약도 완전 파싱 확인 없이는 변경하지 않는다", () => { const result = classifyReservations([existing({ status: "CANCELLED" })], []); assert.deepEqual(result, { create: [], update: [], unchanged: [], blockedDeletionIds: [], staleCancellationIds: [] }); });
test("기존 예약이 없는 명시적 CANCELLED 이벤트도 취소 이력으로 생성한다", () => { const result = classifyReservations([], [normalized({ status: "CANCELLED" })]); assert.equal(result.create.length, 1); assert.equal(result.create[0].status, "CANCELLED"); });
test("신뢰성 확인이 없는 빈 응답은 기존 활성 예약을 변경하지 않는다", () => { assert.deepEqual(classifyReservations([existing()], []), { create: [], update: [], unchanged: [], blockedDeletionIds: [], staleCancellationIds: [] }); });
test("완전 파싱된 피드에서 사라진 현재·미래 UID는 source-scoped 취소 대상으로 분류한다", () => {
  const stale = existing({ id: "stale", rawUid: "old-uid", providerReservationId: "old-uid", startDate: new Date("2026-08-18"), endDate: new Date("2026-08-20") });
  const current = normalized({ rawUid: "new-uid", providerReservationId: "new-uid", startDate: new Date("2026-08-19"), endDate: new Date("2026-08-21") });
  const result = classifyReservations([stale], [current], { observedUids: new Set(["new-uid"]), blockedUids: new Set(), fullyParsed: true, historicalBefore: new Date("2026-08-17") });
  assert.deepEqual(result.staleCancellationIds, ["stale"]);
});
test("완전 파싱에서 BLOCKED UID는 삭제하고 누락 UID는 취소하며 UNKNOWN UID와 불완전 파싱은 보존한다", () => {
  const values = [
    existing({ id: "observed", rawUid: "observed", providerReservationId: "observed", startDate: new Date("2026-08-18"), endDate: new Date("2026-08-20") }),
    existing({ id: "separate", rawUid: "separate", providerReservationId: "separate", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-02") }),
    existing({ id: "past", rawUid: "past", providerReservationId: "past", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-02") }),
  ];
  const incoming = [normalized({ rawUid: "new", providerReservationId: "new", startDate: new Date("2026-08-19"), endDate: new Date("2026-08-21") })];
  assert.deepEqual(classifyReservations(values, incoming, {
    observedUids: new Set(["observed", "new"]),
    blockedUids: new Set(["observed"]),
    fullyParsed: true,
    historicalBefore: new Date("2026-07-01"),
  }), {
    create: [incoming[0]], update: [], unchanged: [],
    blockedDeletionIds: ["observed"], staleCancellationIds: ["separate", "past"],
  });
  assert.deepEqual(classifyReservations([values[0]], incoming, {
    observedUids: new Set(["observed", "new"]),
    blockedUids: new Set(),
    fullyParsed: true,
    historicalBefore: new Date("2026-07-01"),
  }).staleCancellationIds, []);
  assert.deepEqual(classifyReservations([values[0]], incoming, {
    observedUids: new Set(["new"]),
    blockedUids: new Set(["observed"]),
    fullyParsed: false,
    historicalBefore: new Date("2026-07-01"),
  }).blockedDeletionIds, []);
});

test("OTA feed가 체크아웃 뒤 이벤트를 제거해도 과거 예약 이력은 보존한다", () => {
  const checkedOut = existing({
    id: "checked-out",
    rawUid: "checked-out",
    providerReservationId: "checked-out",
    startDate: new Date("2026-09-14T15:00:00.000Z"),
    endDate: new Date("2026-09-16T15:00:00.000Z"),
  });
  const futureMissing = existing({
    id: "future-missing",
    rawUid: "future-missing",
    providerReservationId: "future-missing",
    startDate: new Date("2026-09-19T15:00:00.000Z"),
    endDate: new Date("2026-09-21T15:00:00.000Z"),
  });
  const result = classifyReservations([checkedOut, futureMissing], [], {
    observedUids: new Set(),
    blockedUids: new Set(),
    fullyParsed: true,
    historicalBefore: new Date("2026-09-17T15:00:00.000Z"),
  });
  assert.deepEqual(result.staleCancellationIds, ["future-missing"]);
  assert.equal(result.unchanged.some((item) => item.id === "checked-out"), true);
});

test("체크아웃이 오늘인 누락 예약은 과거가 아니므로 취소 대상으로 분류한다", () => {
  const checkoutToday = existing({ id: "checkout-today", endDate: new Date("2026-09-20T15:00:00.000Z") });
  const result = classifyReservations([checkoutToday], [], {
    observedUids: new Set(), blockedUids: new Set(), fullyParsed: true,
    historicalBefore: new Date("2026-09-20T15:00:00.000Z"),
  });
  assert.deepEqual(result.staleCancellationIds, ["checkout-today"]);
});

test("정상 파싱된 VEVENT 0 피드는 현재·미래 예약만 취소하고 과거 이력은 유지한다", () => {
  const historical = existing({ id: "historical", rawUid: "historical", endDate: new Date("2026-09-19T15:00:00.000Z") });
  const active = existing({ id: "active", rawUid: "active", endDate: new Date("2026-09-20T15:00:00.000Z") });
  const result = classifyReservations([historical, active], [], {
    observedUids: new Set(), blockedUids: new Set(), fullyParsed: true,
    historicalBefore: new Date("2026-09-20T15:00:00.000Z"),
  });
  assert.deepEqual(result.staleCancellationIds, ["active"]);
  assert.deepEqual(result.unchanged.map((reservation) => reservation.id), ["historical"]);
});
