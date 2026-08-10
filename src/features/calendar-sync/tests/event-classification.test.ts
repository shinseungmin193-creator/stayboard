import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyCalendarEvents } from "../domain/classify-calendar-events";
import { classifyReservations } from "../domain/classify-reservations";
import type { ExistingReservation, NormalizedReservation } from "../domain/normalized-reservation";
import { parseIcsCalendar, IcsDocumentParseError } from "../infrastructure/ics-parser";
import { AgodaReservationNormalizer } from "../providers/agoda-normalizer";
import { AirbnbReservationNormalizer } from "../providers/airbnb-normalizer";
import { BookingReservationNormalizer } from "../providers/booking-normalizer";
import { getCalendarProviderLabel } from "../../../providers/calendar/types";
import { getDashboardDateInput } from "../../dashboard/dashboard-time";
import { countFailedCalendarEvents, createCalendarSyncDiagnosticPayload, readCalendarSyncDiagnosticPayload } from "../domain/calendar-sync-diagnostics";

const ics = (events: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}END:VCALENDAR\r\n`;
const event = ({ uid = "one", summary, status, description, organizer }: { uid?: string; summary?: string; status?: string; description?: string; organizer?: string }) => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;VALUE=DATE:20260721\r\nDTEND;VALUE=DATE:20260723\r\n${summary == null ? "" : `SUMMARY:${summary}\r\n`}${status == null ? "" : `STATUS:${status}\r\n`}${description == null ? "" : `DESCRIPTION:${description}\r\n`}${organizer == null ? "" : `ORGANIZER:${organizer}\r\n`}END:VEVENT\r\n`;
const parsedEvent = (input: Parameters<typeof event>[0]) => parseIcsCalendar(ics(event(input))).events[0];
const normalized = (overrides: Partial<NormalizedReservation> = {}): NormalizedReservation => ({ rawUid: "one", providerReservationId: "one", guestName: null, startDate: new Date("2026-07-21T00:00:00.000Z"), endDate: new Date("2026-07-23T00:00:00.000Z"), status: "CONFIRMED", summary: "Reserved", description: null, providerCreatedAt: null, providerUpdatedAt: null, ...overrides });
const existing = (overrides: Partial<ExistingReservation> = {}): ExistingReservation => ({ id: "existing", createdAt: new Date("2026-01-01T00:00:00.000Z"), ...normalized(), ...overrides });

test("Airbnb 차단 문구를 대소문자·공백·Unicode 차이와 무관하게 BLOCKED로 분류한다", () => {
  const normalizer = new AirbnbReservationNormalizer();
  for (const summary of ["Blocked", " Not   available ", "Airbnb (Not available)", "UNAVAILABLE", "Closed", "Owner block", "Ｏｗｎｅｒ blocked", "Airbnb"]) assert.equal(normalizer.classifyEvent(parsedEvent({ summary })), "BLOCKED", summary);
});

test("Airbnb 실제 예약과 guestName 없는 예약을 RESERVATION으로 유지한다", () => {
  const normalizer = new AirbnbReservationNormalizer();
  const reserved = parsedEvent({ summary: "Reserved", description: "Airbnb reservation link" });
  assert.equal(normalizer.classifyEvent(reserved), "RESERVATION");
  assert.equal(normalizer.normalize(reserved).guestName, null);
  assert.equal(normalizer.normalize(reserved).summary, "Airbnb");
  assert.equal(classifyCalendarEvents([reserved], normalizer).reservations[0].status, "CONFIRMED");
});

test("Booking.com 실제 응답의 UID·ORGANIZER 신호를 조합해 예약을 분류한다", () => {
  const normalizer = new BookingReservationNormalizer();
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "stay-1@booking.com", organizer: "mailto:calendar@booking.com", summary: "Stay - Booking.com" })), "RESERVATION");
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "closed@booking.com", organizer: "mailto:calendar@booking.com", summary: "CLOSED - Not available" })), "RESERVATION");
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "closed@booking.com", summary: "closed-not_available" })), "RESERVATION");
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "stay-2@booking.com", organizer: "mailto:calendar@booking.com", summary: "Maintenance" })), "BLOCKED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "stay-3@booking.com", organizer: "mailto:calendar@booking.com", summary: "Stay - Booking.com", status: "CANCELED" })), "CANCELLED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Unverified event" })), "UNKNOWN");
});

test("Booking.com 실제형 fixture의 마스킹 예약·차단·취소·UNKNOWN을 구분한다", () => {
  const content = readFileSync("src/features/calendar-sync/tests/fixtures/booking-calendar.ics", "utf8");
  const parsed = parseIcsCalendar(content);
  const normalizer = new BookingReservationNormalizer();
  assert.equal(parsed.totalEventCount, 5);
  assert.deepEqual(parsed.events.map((item) => normalizer.classifyEvent(item)), ["RESERVATION", "RESERVATION", "BLOCKED", "CANCELLED", "UNKNOWN"]);
  const result = classifyCalendarEvents(parsed.events, normalizer);
  assert.deepEqual({ reservation: result.reservationEventCount, blocked: result.blockedEventCount, cancelled: result.cancelledEventCount, unknown: result.unknownEventCount }, { reservation: 2, blocked: 1, cancelled: 1, unknown: 1 });
  assert.equal(getDashboardDateInput(result.reservations[0].startDate), "2026-07-26");
  assert.equal(getDashboardDateInput(result.reservations[0].endDate), "2026-07-28");
  const persistence = classifyReservations([], result.reservations);
  assert.equal(persistence.create.length, 2);
  assert.equal(getCalendarProviderLabel("BOOKING"), "Booking.com");
});

test("Booking.com 개별 fixture는 실제 예약·명시적 차단·취소를 구분한다", () => {
  const normalizer = new BookingReservationNormalizer();
  const fixture = (name: string) => parseIcsCalendar(readFileSync(`src/features/calendar-sync/tests/fixtures/${name}.ics`, "utf8")).events[0];
  const reservation = fixture("booking-reservation");
  assert.equal(normalizer.classifyEvent(reservation), "RESERVATION");
  assert.equal(classifyCalendarEvents([reservation], normalizer).reservations[0].status, "CONFIRMED");
  assert.equal(normalizer.classifyEvent(fixture("booking-blocked")), "BLOCKED");
  assert.equal(normalizer.classifyEvent(fixture("booking-cancelled")), "CANCELLED");
});

test("Booking.com은 provider identity 없는 CONFIRMED·DESCRIPTION 문구를 예약으로 강제하지 않는다", () => {
  const normalizer = new BookingReservationNormalizer();
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Private event", status: "CONFIRMED" })), "UNKNOWN");
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Private event", description: "booking reservation" })), "UNKNOWN");
});

test("Booking.com 이벤트의 날짜 누락과 malformed 문서는 parser 단계에서 reject한다", () => {
  const missingStart = ics("BEGIN:VEVENT\r\nUID:missing-start@booking.com\r\nDTEND;VALUE=DATE:20260723\r\nSUMMARY:CLOSED - Not available\r\nEND:VEVENT\r\n");
  const missingEnd = ics("BEGIN:VEVENT\r\nUID:missing-end@booking.com\r\nDTSTART;VALUE=DATE:20260721\r\nSUMMARY:CLOSED - Not available\r\nEND:VEVENT\r\n");
  for (const [content, reason] of [[missingStart, "MISSING_START"], [missingEnd, "MISSING_END"]] as const) {
    assert.throws(() => parseIcsCalendar(content), (error) => {
      assert.ok(error instanceof IcsDocumentParseError);
      assert.deepEqual(error.diagnostics?.issues.map((issue) => issue.reason), [reason]);
      return true;
    });
  }
  assert.throws(() => parseIcsCalendar("BEGIN:VCALENDAR\r\nBEGIN:VEVENT"), IcsDocumentParseError);
});

test("Booking UID 중복은 새 예약을 만들지 않고 기존 예약을 update한다", () => {
  const content = readFileSync("src/features/calendar-sync/tests/fixtures/booking-calendar.ics", "utf8");
  const normalizer = new BookingReservationNormalizer();
  const incoming = classifyCalendarEvents(parseIcsCalendar(content).events, normalizer).reservations[0];
  const current = existing({ id: "booking-existing", rawUid: incoming.rawUid, providerReservationId: incoming.providerReservationId, startDate: incoming.startDate, endDate: incoming.endDate, summary: "Old summary", status: "CANCELLED" });
  const result = classifyReservations([current], [incoming]);
  assert.equal(result.create.length, 0);
  assert.equal(result.update.length, 1);
  assert.equal(result.update[0].reservation.status, "CONFIRMED");
});

test("Agoda는 명확한 상태·도메인 신호만 예약으로 인정한다", () => {
  const normalizer = new AgodaReservationNormalizer();
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "stay-1@agoda.com", summary: "Agoda reservation" })), "RESERVATION");
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Agoda reservation", status: "CONFIRMED" })), "RESERVATION");
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Stop sell" })), "BLOCKED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Calendar-blocked", status: "CONFIRMED" })), "BLOCKED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Agoda reservation", status: "CANCELLED" })), "CANCELLED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Unverified event" })), "UNKNOWN");
});

test("SUMMARY 또는 DESCRIPTION의 취소 문구만으로 CANCELLED로 분류하지 않는다", () => {
  const airbnb = new AirbnbReservationNormalizer();
  const booking = new BookingReservationNormalizer();
  const agoda = new AgodaReservationNormalizer();
  assert.notEqual(airbnb.classifyEvent(parsedEvent({ summary: "Cancelled" })), "CANCELLED");
  assert.equal(airbnb.classifyEvent(parsedEvent({ summary: "Reserved", description: "Reservation cancelled" })), "RESERVATION");
  assert.equal(booking.classifyEvent(parsedEvent({ uid: "cancelled@booking.com", summary: "Booking cancelled" })), "RESERVATION");
  assert.equal(agoda.classifyEvent(parsedEvent({ uid: "cancelled@agoda.com", summary: "Agoda cancelled" })), "RESERVATION");
});

test("SUMMARY가 없는 이벤트는 UNKNOWN이며 자동 저장하지 않는다", () => {
  const normalizer = new AirbnbReservationNormalizer();
  const unknown = parsedEvent({});
  assert.equal(normalizer.classifyEvent(unknown), "UNKNOWN");
  const result = classifyCalendarEvents([unknown], normalizer);
  assert.equal(result.reservations.length, 0);
  assert.deepEqual(result.unknownUids, ["one"]);
  assert.deepEqual(result.unknownEvents, [{ uidPresent: true, summaryPreview: null, descriptionPresent: false, status: null, reason: "PROVIDER_CLASSIFIER_NO_MATCH" }]);
});

test("UNKNOWN 진단은 UID·DESCRIPTION 원문과 개인정보 가능 SUMMARY를 저장하지 않는다", () => {
  const description = `고객 메모\u0000 ${"민감정보".repeat(100)}`;
  const result = classifyCalendarEvents([parsedEvent({ summary: "Unverified event", description, status: "TENTATIVE" })], new AirbnbReservationNormalizer());
  assert.equal(result.unknownEvents.length, 1);
  assert.equal(result.unknownEvents[0].uidPresent, true);
  assert.equal(result.unknownEvents[0].descriptionPresent, true);
  assert.equal(result.unknownEvents[0].summaryPreview, "[비공개]");
  assert.equal("uid" in result.unknownEvents[0], false);
  assert.equal("descriptionPreview" in result.unknownEvents[0], false);
  assert.equal(result.unknownEvents[0].reason, "PROVIDER_CLASSIFIER_NO_MATCH");
});

test("동기화 진단은 제외 사유를 집계하고 기존 민감 로그도 안전하게 읽는다", () => {
  const issues = [{ eventIndex: 1, reason: "MISSING_UID" as const }, { eventIndex: 2, reason: "DUPLICATE_UID" as const }];
  assert.equal(countFailedCalendarEvents(issues), 1);
  const classified = classifyCalendarEvents([parsedEvent({ summary: "Unverified event" })], new BookingReservationNormalizer());
  const payload = createCalendarSyncDiagnosticPayload({ events: classified.eventDiagnostics, eventDiagnosticTruncatedCount: classified.eventDiagnosticTruncatedCount, issues, counts: classified });
  assert.deepEqual(payload.exclusionReasonCounts, { PROVIDER_CLASSIFIER_NO_MATCH: 1, MISSING_UID: 1, DUPLICATE_UID: 1 });
  const legacy = readCalendarSyncDiagnosticPayload(null, [{ uid: "private-uid", summary: "Guest Personal Name", descriptionPreview: "email@example.com", status: "TENTATIVE" }]);
  assert.equal(legacy.events[0].uidPresent, true);
  assert.equal(legacy.events[0].summaryPreview, "[비공개]");
  assert.equal(legacy.events[0].descriptionPresent, true);
  assert.equal("uid" in legacy.events[0], false);
});

test("분류 결과는 예약만 저장 대상으로 만들고 차단·미분류 카운트를 남긴다", () => {
  const normalizer = new AirbnbReservationNormalizer();
  const result = classifyCalendarEvents([
    parsedEvent({ uid: "reservation", summary: "Reserved" }),
    parsedEvent({ uid: "blocked", summary: "Airbnb (Not available)" }),
    parsedEvent({ uid: "unknown", summary: "Unverified event" }),
    parsedEvent({ uid: "cancelled", summary: "Reserved", status: "CANCELLED" }),
  ], normalizer, 2);
  assert.deepEqual({ parsed: result.parsedEventCount, reservation: result.reservationEventCount, blocked: result.blockedEventCount, cancelled: result.cancelledEventCount, unknown: result.unknownEventCount, failed: result.failedEventCount, skipped: result.skippedEventCount }, { parsed: 4, reservation: 1, blocked: 1, cancelled: 1, unknown: 1, failed: 2, skipped: 4 });
  assert.deepEqual(result.reservations.map((reservation) => reservation.rawUid), ["reservation", "cancelled"]);
  assert.equal(result.reservations[1].status, "CANCELLED");
});

test("BLOCKED·UNKNOWN·누락 UID는 명시적 STATUS:CANCELLED 없이 기존 예약을 변경하지 않는다", () => {
  const blocked = existing({ id: "blocked", rawUid: "blocked", providerReservationId: "blocked", status: "CONFIRMED", summary: "CLOSED - Not available" });
  const unknown = existing({ id: "unknown", rawUid: "unknown", providerReservationId: "unknown" });
  const missing = existing({ id: "missing", rawUid: "missing", providerReservationId: "missing" });
  const result = classifyReservations([blocked, unknown, missing], []);
  assert.deepEqual(result, { create: [], update: [], unchanged: [] });
});

test("캘린더 전체 파싱 실패 시 동기화가 중단되어 기존 예약을 보존한다", () => {
  assert.throws(() => parseIcsCalendar("not-an-ics"), IcsDocumentParseError);
  const invalidOnly = ics("BEGIN:VEVENT\r\nUID:invalid\r\nDTSTART;VALUE=DATE:20260722\r\nDTEND;VALUE=DATE:20260721\r\nEND:VEVENT\r\n");
  assert.throws(() => parseIcsCalendar(invalidOnly), (error) => {
    assert.ok(error instanceof IcsDocumentParseError);
    assert.equal(error.diagnostics?.totalEventCount, 1);
    assert.equal(error.diagnostics?.parsedEventCount, 0);
    assert.deepEqual(error.diagnostics?.issues.map((issue) => issue.reason), ["INVALID_RANGE"]);
    return true;
  });
});
