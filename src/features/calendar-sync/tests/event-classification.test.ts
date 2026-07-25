import test from "node:test";
import assert from "node:assert/strict";
import { canCancelMissingReservations, classifyCalendarEvents } from "../domain/classify-calendar-events";
import { classifyReservations } from "../domain/classify-reservations";
import type { ExistingReservation, NormalizedReservation } from "../domain/normalized-reservation";
import { parseIcsCalendar, IcsDocumentParseError } from "../infrastructure/ics-parser";
import { AgodaReservationNormalizer } from "../providers/agoda-normalizer";
import { AirbnbReservationNormalizer } from "../providers/airbnb-normalizer";
import { BookingReservationNormalizer } from "../providers/booking-normalizer";

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
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "closed@booking.com", organizer: "mailto:calendar@booking.com", summary: "CLOSED - Not available", status: "CONFIRMED" })), "BLOCKED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "closed@booking.com", organizer: "mailto:calendar@booking.com", summary: "closed–not_available", status: "CONFIRMED" })), "BLOCKED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "stay-2@booking.com", organizer: "mailto:calendar@booking.com", summary: "Maintenance" })), "BLOCKED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ uid: "stay-3@booking.com", organizer: "mailto:calendar@booking.com", summary: "Stay - Booking.com", status: "CANCELED" })), "CANCELLED");
  assert.equal(normalizer.classifyEvent(parsedEvent({ summary: "Unverified event" })), "UNKNOWN");
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

test("SUMMARY가 없는 이벤트는 UNKNOWN이며 자동 저장하지 않는다", () => {
  const normalizer = new AirbnbReservationNormalizer();
  const unknown = parsedEvent({});
  assert.equal(normalizer.classifyEvent(unknown), "UNKNOWN");
  const result = classifyCalendarEvents([unknown], normalizer);
  assert.equal(result.reservations.length, 0);
  assert.deepEqual(result.unknownUids, ["one"]);
  assert.deepEqual(result.unknownEvents, [{ uid: "one", summary: null, descriptionPreview: null, status: null, reason: "PROVIDER_CLASSIFIER_NO_MATCH" }]);
});

test("UNKNOWN 로그 샘플은 제어 문자를 제거하고 DESCRIPTION을 제한한다", () => {
  const description = `고객 메모\u0000 ${"민감정보".repeat(100)}`;
  const result = classifyCalendarEvents([parsedEvent({ summary: "Unverified event", description, status: "TENTATIVE" })], new AirbnbReservationNormalizer());
  assert.equal(result.unknownEvents.length, 1);
  assert.equal(result.unknownEvents[0].descriptionPreview?.includes("\u0000"), false);
  assert.equal(result.unknownEvents[0].descriptionPreview?.length, 240);
  assert.equal(result.unknownEvents[0].reason, "PROVIDER_CLASSIFIER_NO_MATCH");
});

test("분류 결과는 예약만 저장 대상으로 만들고 차단·미분류 카운트를 남긴다", () => {
  const normalizer = new AirbnbReservationNormalizer();
  const result = classifyCalendarEvents([
    parsedEvent({ uid: "reservation", summary: "Reserved" }),
    parsedEvent({ uid: "blocked", summary: "Airbnb (Not available)" }),
    parsedEvent({ uid: "unknown", summary: "Unverified event" }),
    parsedEvent({ uid: "cancelled", summary: "Reserved", status: "CANCELLED" }),
  ], normalizer, 2);
  assert.deepEqual({ parsed: result.parsedEventCount, reservation: result.reservationEventCount, blocked: result.blockedEventCount, cancelled: result.cancelledEventCount, unknown: result.unknownEventCount, skipped: result.skippedEventCount }, { parsed: 4, reservation: 1, blocked: 1, cancelled: 1, unknown: 1, skipped: 4 });
  assert.deepEqual(result.reservations.map((reservation) => reservation.rawUid), ["reservation", "cancelled"]);
  assert.equal(result.reservations[1].status, "CANCELLED");
});

test("기존에 CONFIRMED로 잘못 저장된 BLOCKED UID만 취소하고 UNKNOWN UID는 보호한다", () => {
  const blocked = existing({ id: "blocked", rawUid: "blocked", providerReservationId: "blocked", status: "CONFIRMED", summary: "CLOSED - Not available" });
  const unknown = existing({ id: "unknown", rawUid: "unknown", providerReservationId: "unknown" });
  const missing = existing({ id: "missing", rawUid: "missing", providerReservationId: "missing" });
  const result = classifyReservations([blocked, unknown, missing], [], new Date(), { blockedUids: new Set(["blocked"]), protectedUids: new Set(["unknown"]), allowMissingCancellation: false });
  assert.deepEqual(result.cancelIds, ["blocked"]);
});

test("미분류 또는 불완전 파싱이 있으면 누락 예약 자동 취소를 중단한다", () => {
  assert.equal(canCancelMissingReservations([], 0), true);
  assert.equal(canCancelMissingReservations([{ eventIndex: 1, reason: "DUPLICATE_UID" }], 0), true);
  assert.equal(canCancelMissingReservations([], 1), false);
  assert.equal(canCancelMissingReservations([{ eventIndex: 1, reason: "MISSING_UID" }], 0), false);
  assert.throws(() => parseIcsCalendar("not-an-ics"), IcsDocumentParseError);
});
