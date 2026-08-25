import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCalendarFeedConnection } from "../domain/calendar-feed-connection-validation";
import { planCalendarSourceReservationReplacement, prepareCalendarSourceUrlReplacement } from "../domain/calendar-source-url-replacement";
import type { CalendarFeedFingerprint } from "../../calendar-sync/domain/calendar-feed-fingerprint";
import type { CalendarFeedSafetyDiagnostics } from "../../calendar-sync/domain/calendar-feed-safety";
import type { CalendarEventClassificationCounts } from "../../calendar-sync/domain/classify-calendar-events";
import type { NormalizedReservation } from "../../calendar-sync/domain/normalized-reservation";

const fingerprint: CalendarFeedFingerprint = {
  version: 1,
  provider: "BOOKING",
  calendarHostname: "ical.booking.com",
  prodIdFingerprint: "prod-hash",
  totalEventCount: 3,
  parsedEventCount: 3,
  reservationCount: 2,
  blockedCount: 1,
  cancelledCount: 0,
  unknownCount: 0,
  uidNamespaceFingerprint: "uid-hash",
  organizerDomainFingerprint: "organizer-hash",
  structuralFingerprint: "structure-hash",
  providerIdentityRatio: 1,
};
const safetyDiagnostics: CalendarFeedSafetyDiagnostics = {
  version: 1,
  reasonCodes: [],
  existingFutureReservationCount: 2,
  missingFutureReservationCount: 0,
  disappearanceRatio: 0,
  unknownRatio: 0,
  baselineUnknownRatio: 0,
  baselineReservationCount: 2,
  incomingReservationCount: 2,
  newReservationCandidateCount: 0,
  currentConflictCount: 0,
  previewConflictCount: 0,
  newConflictCount: 0,
  providerIdentityRatio: 1,
  baselineProviderIdentityRatio: 1,
};
const emptyCounts: CalendarEventClassificationCounts = {
  parsedEventCount: 0,
  reservationEventCount: 0,
  blockedEventCount: 0,
  cancelledEventCount: 0,
  unknownEventCount: 0,
  failedEventCount: 0,
  skippedEventCount: 0,
};
const emptyFingerprint: CalendarFeedFingerprint = {
  ...fingerprint,
  totalEventCount: 0,
  parsedEventCount: 0,
  reservationCount: 0,
  blockedCount: 0,
  unknownCount: 0,
  uidNamespaceFingerprint: null,
  organizerDomainFingerprint: null,
  providerIdentityRatio: 0,
};
const eventDiagnostics = { version: 1 as const, events: [], truncatedEventCount: 0, exclusionReasonCounts: {} };
const incomingReservation: NormalizedReservation = {
  rawUid: "new-booking@booking.com",
  providerReservationId: "new-booking",
  guestName: null,
  startDate: new Date("2026-08-23T00:00:00.000Z"),
  endDate: new Date("2026-08-25T00:00:00.000Z"),
  status: "CONFIRMED",
  summary: "Stay - Booking.com",
  description: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
};
const defaultInspection = {
  normalizedUrl: "https://ical.booking.com/v1/export?t=new-secret",
  fingerprint,
  safetyDiagnostics,
  fetchedCount: 3,
  eventCounts: { ...emptyCounts, parsedEventCount: 3, reservationEventCount: 1 },
  reservations: [incomingReservation],
  unknownEvents: [],
  eventDiagnostics,
  warning: false,
  fetchedAt: new Date("2026-08-10T03:00:00.000Z"),
};

test("Booking URL 직접 교체는 전체 검증 후 기존 CalendarSource ID·Provider·Room을 유지하고 새 baseline을 만든다", async () => {
  const calls: string[] = [];
  const fetchedAt = new Date("2026-08-10T03:00:00.000Z");
  const result = await prepareCalendarSourceUrlReplacement(
    { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: "https://ical.booking.com/v1/export?t=new-secret" },
    {
      findSource: async () => { calls.push("find-source"); return { id: "source-existing", roomId: "room-1", propertyId: "property-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old-secret" }; },
      validateUrl: (_provider, value) => { calls.push("provider-url-validation"); return value; },
      hasDuplicate: async () => { calls.push("duplicate-check"); return false; },
      inspect: async () => { calls.push("fetch-parse-classify"); return { ...defaultInspection, fetchedAt }; },
    },
  );
  assert.deepEqual(calls, ["find-source", "provider-url-validation", "duplicate-check", "fetch-parse-classify"]);
  assert.deepEqual({ id: result.calendarSourceId, roomId: result.roomId, propertyId: result.propertyId, provider: result.provider, companyId: result.companyId }, { id: "source-existing", roomId: "room-1", propertyId: "property-1", provider: "BOOKING", companyId: "company-1" });
  assert.equal(result.previousCalendarUrl, "https://ical.booking.com/v1/export?t=old-secret");
  assert.equal(result.calendarUrl, "https://ical.booking.com/v1/export?t=new-secret");
  assert.equal(result.fingerprint, fingerprint);
  assert.deepEqual(result.reservations, [incomingReservation]);
  assert.equal(result.baselineAt, fetchedAt);
});

test("정상 빈 Booking VCALENDAR는 Provider identity가 없어도 연결 검증을 통과한다", () => {
  assert.deepEqual(
    validateCalendarFeedConnection({ provider: "BOOKING", fetchedEventCount: 0, counts: emptyCounts, fingerprint: emptyFingerprint }),
    { valid: true },
  );
});

test("정상 빈 feed는 기존 source 예약 유무와 관계없이 source 교체 준비를 통과한다", async () => {
  const result = await prepareCalendarSourceUrlReplacement(
    { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: "https://ical.booking.com/v1/export?t=empty" },
    {
      findSource: async () => ({ id: "source-existing", roomId: "room-1", propertyId: "property-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old" }),
      validateUrl: (_provider, value) => value,
      hasDuplicate: async () => false,
      inspect: async () => ({ ...defaultInspection, normalizedUrl: "https://ical.booking.com/v1/export?t=empty", fingerprint: emptyFingerprint, safetyDiagnostics: { ...safetyDiagnostics, reasonCodes: [], existingFutureReservationCount: 0, missingFutureReservationCount: 0, incomingReservationCount: 0 }, fetchedCount: 0, eventCounts: emptyCounts, reservations: [], fetchedAt: new Date("2026-08-10T03:00:00.000Z") }),
    },
  );
  assert.equal(result.calendarSourceId, "source-existing");
  assert.equal(result.calendarUrl, "https://ical.booking.com/v1/export?t=empty");
  assert.deepEqual(result.reservations, []);
  assert.deepEqual(result.safetyDiagnostics.reasonCodes, []);
});

test("기존 예약이 없는 빈 feed는 URL 교체 허용 상태다", async () => {
  const result = await prepareCalendarSourceUrlReplacement(
    { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: "https://ical.booking.com/v1/export?t=empty-safe" },
    {
      findSource: async () => ({ id: "source-existing", roomId: "room-1", propertyId: "property-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old" }),
      validateUrl: (_provider, value) => value,
      hasDuplicate: async () => false,
      inspect: async () => ({ ...defaultInspection, normalizedUrl: "https://ical.booking.com/v1/export?t=empty-safe", fingerprint: emptyFingerprint, safetyDiagnostics: { ...safetyDiagnostics, reasonCodes: [], existingFutureReservationCount: 0, baselineReservationCount: 0, incomingReservationCount: 0 }, fetchedCount: 0, eventCounts: emptyCounts, reservations: [], fetchedAt: new Date() }),
    },
  );
  assert.deepEqual(result.reservations, []);
});

for (const failure of ["DOWNLOAD_FAILED", "PARSE_FAILED"] as const) {
  test(`${failure}이면 URL 교체 준비가 실패하고 저장 단계로 진행하지 않는다`, async () => {
    await assert.rejects(() => prepareCalendarSourceUrlReplacement(
      { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: `https://ical.booking.com/v1/export?t=${failure}` },
      {
        findSource: async () => ({ id: "source-existing", roomId: "room-1", propertyId: "property-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old" }),
        validateUrl: (_provider, value) => value,
        hasDuplicate: async () => false,
        inspect: async () => { throw new Error(failure); },
      },
    ), new RegExp(failure));
  });
}

test("VEVENT가 있는 명백한 타 Provider feed는 Booking 연결 검증에서 차단한다", () => {
  const result = validateCalendarFeedConnection({
    provider: "BOOKING",
    fetchedEventCount: 3,
    counts: { ...emptyCounts, parsedEventCount: 3, reservationEventCount: 3 },
    fingerprint: { ...fingerprint, providerIdentityRatio: 0 },
  });
  assert.deepEqual(result, { valid: false, reason: "PROVIDER_IDENTITY_MISMATCH" });
});

test("Booking 이벤트가 대부분 UNKNOWN이면 기존 Provider 분류 기준대로 저장을 차단한다", () => {
  const result = validateCalendarFeedConnection({
    provider: "BOOKING",
    fetchedEventCount: 6,
    counts: { ...emptyCounts, parsedEventCount: 6, reservationEventCount: 2, unknownEventCount: 4 },
    fingerprint: { ...fingerprint, totalEventCount: 6, parsedEventCount: 6, reservationCount: 2, unknownCount: 4 },
  });
  assert.deepEqual(result, { valid: false, reason: "EVENT_CLASSIFICATION_FAILED" });
});

test("Booking 전용 연결 identity guard가 Airbnb와 Agoda URL 교체를 차단하지 않는다", () => {
  for (const provider of ["AIRBNB", "AGODA"] as const) {
    const result = validateCalendarFeedConnection({
      provider,
      fetchedEventCount: 3,
      counts: { ...emptyCounts, parsedEventCount: 3, reservationEventCount: 3 },
      fingerprint: { ...fingerprint, provider, providerIdentityRatio: 0 },
    });
    assert.deepEqual(result, { valid: true }, provider);
  }
});

test("source 교체 계획은 대상 CalendarSource 예약만 제거하고 새 feed 예약만 생성한다", () => {
  const existing = [
    { id: "booking-a-1", calendarSourceId: "booking-a" },
    { id: "booking-a-2", calendarSourceId: "booking-a" },
    { id: "booking-b-1", calendarSourceId: "booking-b" },
    { id: "agoda-1", calendarSourceId: "agoda-c" },
  ];
  const result = planCalendarSourceReservationReplacement("booking-a", existing, [incomingReservation]);
  assert.deepEqual(result.removeReservationIds, ["booking-a-1", "booking-a-2"]);
  assert.deepEqual(result.createReservations, [incomingReservation]);
});

test("빈 새 feed의 source 교체 계획은 대상 예약을 제거하고 생성 예약을 0건으로 둔다", () => {
  const result = planCalendarSourceReservationReplacement(
    "booking-a",
    [{ id: "booking-a-1", calendarSourceId: "booking-a" }],
    [],
  );
  assert.deepEqual(result, { removeReservationIds: ["booking-a-1"], createReservations: [] });
});

test("새 feed에 취소 이벤트만 있으면 기존 sync lifecycle처럼 신규 Reservation을 만들지 않는다", () => {
  const result = planCalendarSourceReservationReplacement(
    "booking-a",
    [],
    [{ ...incomingReservation, status: "CANCELLED" }],
  );
  assert.deepEqual(result.createReservations, []);
});

test("URL 교체 transaction은 source-scoped 삭제·즉시 sync·마스킹 감사를 한 원자 작업으로 수행한다", () => {
  const repository = readFileSync("src/features/calendar-sources/calendar-source.repository.ts", "utf8");
  const removal = readFileSync("src/features/calendar-sync/infrastructure/calendar-source-reservation-removal.ts", "utf8");
  const start = repository.indexOf("export async function replaceCalendarSourceUrlTransaction");
  const replacement = repository.slice(start, repository.indexOf("export function setCalendarSourceActive", start));
  assert.match(replacement, /reservation\.findMany\(\{\s*where: \{ calendarSourceId: source\.id \}/);
  assert.match(replacement, /removeCalendarSourceReservations\(tx, \{[\s\S]*calendarSourceId: source\.id/);
  assert.match(removal, /reservation\.deleteMany\(\{[\s\S]*calendarSourceId: input\.calendarSourceId/);
  assert.doesNotMatch(removal, /roomId: input\.roomId[\s\S]{0,160}provider:/);
  assert.match(replacement, /syncLog\.create/);
  assert.match(replacement, /status: "SUCCESS"/);
  assert.match(replacement, /detectRoomReservationConflicts/);
  assert.match(replacement, /previousCalendarUrl: maskCalendarUrl/);
  assert.match(replacement, /removedReservationCount/);
  assert.match(replacement, /createdReservationCount/);
  const action = readFileSync("src/features/calendar-sources/calendar-source.actions.ts", "utf8");
  const actionStart = action.indexOf("export async function replaceCalendarSourceUrlAction");
  const replacementAction = action.slice(actionStart, action.indexOf("async function applyCalendarSourceActiveChange", actionStart));
  assert.doesNotMatch(replacementAction, /syncCalendarSource\(/);
  assert.match(replacementAction, /revalidatePath\("\/reservation-conflicts"\)/);
});
