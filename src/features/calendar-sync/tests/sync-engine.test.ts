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

test("VEVENT와 all-day 날짜를 파싱한다", () => { const result = parseIcsCalendar(ics(validEvent)); assert.equal(result.totalEventCount, 1); assert.equal(result.events.length, 1); assert.equal(result.events[0].uid, "one"); assert.ok(result.events[0].endDate > result.events[0].startDate); });
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
test("신규·수정·동일 예약을 분류하고 검증 없는 누락 예약은 변경하지 않는다", () => { const current = existing(); const created = normalized({ rawUid: "new", providerReservationId: "new", summary: "New" }); const changed = normalized({ summary: "Changed" }); const missing = existing({ id: "missing", rawUid: "missing", providerReservationId: "missing" }); const same = existing({ id: "same", rawUid: "same", providerReservationId: "same" }); const incomingSame = normalized({ rawUid: "same", providerReservationId: "same" }); const result = classifyReservations([current, missing, same], [changed, created, incomingSame]); assert.equal(result.create.length, 1); assert.equal(result.update.length, 1); assert.equal(result.unchanged.length, 1); assert.equal(result.update.some((item) => item.id === missing.id), false); assert.deepEqual(result.missingDeletionIds, []); });
test("필드 변경과 CANCELLED 예약 재등장을 update로 분류한다", () => { assert.equal(reservationFieldsEqual(existing(), normalized({ summary: "Changed" })), false); const result = classifyReservations([existing({ status: "CANCELLED" })], [normalized({ status: "CONFIRMED" })]); assert.equal(result.update.length, 1); });
test("이미 취소된 누락 예약도 완전 파싱 확인 없이는 변경하지 않는다", () => { const result = classifyReservations([existing({ status: "CANCELLED" })], []); assert.deepEqual(result, { create: [], update: [], unchanged: [], missingDeletionIds: [] }); });
test("기존 예약이 없는 CANCELLED 이벤트는 새 Reservation으로 만들지 않는다", () => { const result = classifyReservations([], [normalized({ status: "CANCELLED" })]); assert.equal(result.create.length, 0); assert.equal(result.update.length, 0); });
test("안전 검증을 통과하지 않은 빈 ICS는 기존 활성 예약을 변경하지 않는다", () => { assert.deepEqual(classifyReservations([existing()], []), { create: [], update: [], unchanged: [], missingDeletionIds: [] }); });
test("완전 파싱된 피드에서 사라진 UID는 source reconciliation 삭제 대상으로 분류한다", () => {
  const stale = existing({ id: "stale", rawUid: "old-uid", providerReservationId: "old-uid", startDate: new Date("2026-08-18"), endDate: new Date("2026-08-20") });
  const current = normalized({ rawUid: "new-uid", providerReservationId: "new-uid", startDate: new Date("2026-08-19"), endDate: new Date("2026-08-21") });
  const result = classifyReservations([stale], [current], { observedUids: new Set(["new-uid"]), fullyParsed: true });
  assert.deepEqual(result.missingDeletionIds, ["stale"]);
});
test("관찰된 BLOCKED·UNKNOWN UID와 불완전 파싱은 삭제하지 않고 완전 파싱의 다른 누락 UID는 삭제한다", () => {
  const values = [
    existing({ id: "observed", rawUid: "observed", providerReservationId: "observed", startDate: new Date("2026-08-18"), endDate: new Date("2026-08-20") }),
    existing({ id: "separate", rawUid: "separate", providerReservationId: "separate", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-02") }),
    existing({ id: "past", rawUid: "past", providerReservationId: "past", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-02") }),
  ];
  const incoming = [normalized({ rawUid: "new", providerReservationId: "new", startDate: new Date("2026-08-19"), endDate: new Date("2026-08-21") })];
  assert.deepEqual(classifyReservations(values, incoming, { observedUids: new Set(["observed", "new"]), fullyParsed: true }).missingDeletionIds, ["separate", "past"]);
  assert.deepEqual(classifyReservations([values[0]], incoming, { observedUids: new Set(["new"]), fullyParsed: false }).missingDeletionIds, []);
});
