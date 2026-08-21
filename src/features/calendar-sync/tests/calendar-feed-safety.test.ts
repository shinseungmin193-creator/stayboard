import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CalendarProviderType } from "../../../providers/calendar";
import { createCalendarFeedFingerprint, type CalendarFeedFingerprint } from "../domain/calendar-feed-fingerprint";
import { validateCalendarFeedTransition, type CalendarFeedSafetyReservation } from "../domain/calendar-feed-safety";
import type { CalendarEventClassificationCounts } from "../domain/classify-calendar-events";
import type { NormalizedReservation } from "../domain/normalized-reservation";

const now = new Date("2026-08-10T00:00:00.000Z");
const counts = (overrides: Partial<CalendarEventClassificationCounts> = {}): CalendarEventClassificationCounts => ({
  parsedEventCount: 4,
  reservationEventCount: 3,
  blockedEventCount: 1,
  cancelledEventCount: 0,
  unknownEventCount: 0,
  failedEventCount: 0,
  skippedEventCount: 1,
  ...overrides,
});
const fingerprint = (provider: CalendarProviderType = "BOOKING", overrides: Partial<CalendarFeedFingerprint> = {}): CalendarFeedFingerprint => ({
  version: 1,
  provider,
  calendarHostname: provider === "BOOKING" ? "ical.booking.com" : provider === "AIRBNB" ? "www.airbnb.com" : "ycs.agoda.com",
  prodIdFingerprint: "prod-booking",
  totalEventCount: 4,
  parsedEventCount: 4,
  reservationCount: 3,
  blockedCount: 1,
  cancelledCount: 0,
  unknownCount: 0,
  uidNamespaceFingerprint: "uid-booking",
  organizerDomainFingerprint: "organizer-booking",
  structuralFingerprint: "structure-booking",
  providerIdentityRatio: 1,
  ...overrides,
});
const incoming = (uid: string, startDay: number, endDay = startDay + 2, overrides: Partial<NormalizedReservation> = {}): NormalizedReservation => ({
  rawUid: uid,
  providerReservationId: uid,
  guestName: null,
  startDate: new Date(Date.UTC(2026, 7, startDay)),
  endDate: new Date(Date.UTC(2026, 7, endDay)),
  status: "CONFIRMED",
  summary: "Booking.com",
  description: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
  ...overrides,
});
const stored = (uid: string, startDay: number, endDay = startDay + 2, overrides: Partial<CalendarFeedSafetyReservation> = {}): CalendarFeedSafetyReservation => ({
  id: `stored-${uid}`,
  rawUid: uid,
  calendarSourceId: "source-booking",
  roomId: "room-1",
  startDate: new Date(Date.UTC(2026, 7, startDay)),
  endDate: new Date(Date.UTC(2026, 7, endDay)),
  status: "CONFIRMED",
  ...overrides,
});

function validate(overrides: Partial<Parameters<typeof validateCalendarFeedTransition>[0]> = {}) {
  const incomingReservations = [incoming("stay-1@booking.com", 12), incoming("stay-2@booking.com", 16), incoming("stay-3@booking.com", 20)];
  const sourceReservations = incomingReservations.map((item, index) => stored(item.rawUid, 12 + index * 4));
  return validateCalendarFeedTransition({
    provider: "BOOKING",
    sourceId: "source-booking",
    now,
    fetchedEventCount: 4,
    counts: counts(),
    fingerprint: fingerprint(),
    baselineFingerprint: fingerprint(),
    previousSuccessfulCounts: null,
    sourceReservations,
    roomReservations: sourceReservations,
    incomingReservations,
    ...overrides,
  });
}

test("정상 Booking 피드는 저장 허용 상태다", () => {
  assert.equal(validate().status, "SAFE");
});

test("활성 예약이 있는데 빈 피드가 오면 격리한다", () => {
  const sourceReservations = Array.from({ length: 5 }, (_, index) => stored(`future-${index}@booking.com`, 12 + index * 3));
  const result = validate({ fetchedEventCount: 0, counts: counts({ parsedEventCount: 0, reservationEventCount: 0, blockedEventCount: 0, skippedEventCount: 0 }), fingerprint: fingerprint("BOOKING", { totalEventCount: 0, parsedEventCount: 0, reservationCount: 0, blockedCount: 0, uidNamespaceFingerprint: null, organizerDomainFingerprint: null, providerIdentityRatio: 0 }), sourceReservations, roomReservations: sourceReservations, incomingReservations: [] });
  assert.equal(result.status, "QUARANTINED");
  if (result.status === "QUARANTINED") assert.ok(result.reasonCodes.includes("EMPTY_FEED_WITH_ACTIVE_RESERVATIONS"));
});

test("기존 미래 예약이 대량으로 사라지면 격리한다", () => {
  const sourceReservations = Array.from({ length: 8 }, (_, index) => stored(`future-${index}@booking.com`, 12 + index * 3));
  const result = validate({ sourceReservations, roomReservations: sourceReservations, incomingReservations: [incoming("future-0@booking.com", 12)], counts: counts({ parsedEventCount: 1, reservationEventCount: 1, blockedEventCount: 0, skippedEventCount: 0 }), fingerprint: fingerprint("BOOKING", { totalEventCount: 1, parsedEventCount: 1, reservationCount: 1, blockedCount: 0 }) });
  assert.equal(result.status, "QUARANTINED");
  if (result.status === "QUARANTINED") assert.ok(result.reasonCodes.includes("MASS_RESERVATION_DISAPPEARANCE"));
});

test("UID namespace와 공급자 구조가 함께 바뀌면 격리한다", () => {
  const result = validate({ fingerprint: fingerprint("BOOKING", { uidNamespaceFingerprint: "uid-other", organizerDomainFingerprint: "organizer-other", prodIdFingerprint: "prod-other" }) });
  assert.equal(result.status, "QUARANTINED");
  if (result.status === "QUARANTINED") assert.ok(result.reasonCodes.includes("UID_NAMESPACE_DRIFT"));
});

test("UNKNOWN 이벤트 비율이 급증하면 격리한다", () => {
  const result = validate({ counts: counts({ parsedEventCount: 6, reservationEventCount: 2, blockedEventCount: 0, unknownEventCount: 4, skippedEventCount: 4 }), fingerprint: fingerprint("BOOKING", { totalEventCount: 6, parsedEventCount: 6, reservationCount: 2, blockedCount: 0, unknownCount: 4 }) });
  assert.equal(result.status, "QUARANTINED");
  if (result.status === "QUARANTINED") assert.ok(result.reasonCodes.includes("UNRECOGNIZED_EVENT_SPIKE"));
});

test("이전 기준선 대비 예약 이벤트가 비정상적으로 급증하면 격리한다", () => {
  const many = Array.from({ length: 8 }, (_, index) => incoming(`spike-${index}@booking.com`, 12 + index * 3));
  const result = validate({ counts: counts({ parsedEventCount: 8, reservationEventCount: 8, blockedEventCount: 0, skippedEventCount: 0 }), fingerprint: fingerprint("BOOKING", { totalEventCount: 8, parsedEventCount: 8, reservationCount: 8, blockedCount: 0 }), baselineFingerprint: fingerprint("BOOKING", { totalEventCount: 2, parsedEventCount: 2, reservationCount: 2, blockedCount: 0 }), sourceReservations: [], roomReservations: [], incomingReservations: many });
  assert.equal(result.status, "QUARANTINED");
  if (result.status === "QUARANTINED") assert.ok(result.reasonCodes.includes("SUSPICIOUS_RESERVATION_SPIKE"));
});

test("정상적인 신규 예약 1건과 충돌 1건은 허용한다", () => {
  const other = stored("other@airbnb.com", 12, 14, { id: "other", calendarSourceId: "source-airbnb" });
  const result = validate({ sourceReservations: [], roomReservations: [other], incomingReservations: [incoming("new@booking.com", 13, 15)], counts: counts({ parsedEventCount: 1, reservationEventCount: 1, blockedEventCount: 0, skippedEventCount: 0 }), fingerprint: fingerprint("BOOKING", { totalEventCount: 1, parsedEventCount: 1, reservationCount: 1, blockedCount: 0 }), baselineFingerprint: null });
  assert.equal(result.status, "SAFE");
  assert.equal(result.diagnostics.newConflictCount, 1);
});

test("다수의 신규 충돌을 만드는 피드는 DB 입력을 변경하지 않고 격리한다", () => {
  const other = stored("other@airbnb.com", 12, 25, { id: "other", calendarSourceId: "source-airbnb" });
  const incomingReservations = [incoming("new-1@booking.com", 13, 16), incoming("new-2@booking.com", 17, 20), incoming("new-3@booking.com", 21, 24)];
  const roomReservations = [other];
  const before = JSON.stringify({ roomReservations, incomingReservations });
  const result = validate({ sourceReservations: [], roomReservations, incomingReservations, counts: counts({ parsedEventCount: 3, reservationEventCount: 3, blockedEventCount: 0, skippedEventCount: 0 }), fingerprint: fingerprint("BOOKING", { totalEventCount: 3, parsedEventCount: 3, reservationCount: 3, blockedCount: 0 }), baselineFingerprint: null });
  assert.equal(result.status, "QUARANTINED");
  if (result.status === "QUARANTINED") assert.ok(result.reasonCodes.includes("MASS_CONFLICT_INTRODUCTION"));
  assert.equal(JSON.stringify({ roomReservations, incomingReservations }), before);
});

test("명시적 URL 교체의 baseline reset은 비교형 drift를 무시하되 공급자 identity는 검증한다", () => {
  const reset = validate({ baselineReset: true, fingerprint: fingerprint("BOOKING", { uidNamespaceFingerprint: "new-namespace", organizerDomainFingerprint: "new-organizer", prodIdFingerprint: "new-prod" }) });
  assert.equal(reset.status, "SAFE");
  const invalidIdentity = validate({ baselineReset: true, fingerprint: fingerprint("BOOKING", { providerIdentityRatio: 0 }) });
  assert.equal(invalidIdentity.status, "QUARANTINED");
});

test("Airbnb와 Agoda는 Booking 전용 guard로 회귀 차단되지 않는다", () => {
  for (const provider of ["AIRBNB", "AGODA"] as const) {
    const result = validate({ provider, fetchedEventCount: 8, counts: counts({ parsedEventCount: 8, reservationEventCount: 8, blockedEventCount: 0, skippedEventCount: 0 }), fingerprint: fingerprint(provider, { totalEventCount: 8, parsedEventCount: 8, reservationCount: 8, blockedCount: 0, providerIdentityRatio: 0 }), baselineFingerprint: fingerprint(provider, { totalEventCount: 1, parsedEventCount: 1, reservationCount: 1, blockedCount: 0 }), sourceReservations: [], roomReservations: [], incomingReservations: Array.from({ length: 8 }, (_, index) => incoming(`${provider}-${index}`, 12 + index)) });
    assert.equal(result.status, "SAFE", provider);
  }
});

test("피드 fingerprint에는 원문 UID, organizer, URL token이 남지 않는다", () => {
  const rawUid = "private-reservation-12345@booking.com";
  const rawOrganizer = "mailto:guest-secret@booking.com";
  const result = createCalendarFeedFingerprint({
    provider: "BOOKING",
    calendarHostname: "ical.booking.com",
    prodId: "-//Booking.com//SECRET-PROD-ID//EN",
    totalEventCount: 1,
    events: [{ uid: rawUid, startDate: new Date("2026-08-12"), endDate: new Date("2026-08-14"), summary: "Guest Secret", description: "private", status: "CONFIRMED", createdAt: null, lastModifiedAt: null, sequence: 0, dtstamp: null, rawProperties: { organizer: rawOrganizer, transp: "OPAQUE" } }],
    counts: counts({ parsedEventCount: 1, reservationEventCount: 1, blockedEventCount: 0, skippedEventCount: 0 }),
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /private-reservation|guest-secret|SECRET-PROD-ID|token/i);
  assert.equal(result.calendarHostname, "ical.booking.com");
});

test("격리 검증은 일반 sync persistence보다 먼저 실행되고 URL 교체는 같은 CalendarSource 안에서 source-scoped 교체한다", () => {
  const syncSource = readFileSync("src/features/calendar-sync/application/sync-calendar-source.ts", "utf8");
  assert.ok(syncSource.indexOf("validateCalendarFeedTransition") < syncSource.indexOf("persistReservationSync({"));
  const repository = readFileSync("src/features/calendar-sources/calendar-source.repository.ts", "utf8");
  const start = repository.indexOf("export async function replaceCalendarSourceUrlTransaction");
  const replacement = repository.slice(start, repository.indexOf("export function setCalendarSourceActive", start));
  assert.match(replacement, /calendarSource\.update/);
  assert.doesNotMatch(replacement, /calendarSource\.(delete|create)/);
  assert.match(replacement, /reservation\.deleteMany/);
  assert.match(replacement, /calendarSourceId: source\.id/);
  assert.match(replacement, /reservation\.createMany/);
  assert.match(replacement, /syncLog\.create/);
});
