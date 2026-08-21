import test from "node:test";
import assert from "node:assert/strict";
import { validateCalendarFeedConnection } from "../domain/calendar-feed-connection-validation";
import { prepareCalendarSourceUrlReplacement } from "../domain/calendar-source-url-replacement";
import type { CalendarFeedFingerprint } from "../../calendar-sync/domain/calendar-feed-fingerprint";
import type { CalendarFeedSafetyDiagnostics } from "../../calendar-sync/domain/calendar-feed-safety";
import type { CalendarEventClassificationCounts } from "../../calendar-sync/domain/classify-calendar-events";

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

test("Booking URL 직접 교체는 전체 검증 후 기존 CalendarSource ID·Provider·Room을 유지하고 새 baseline을 만든다", async () => {
  const calls: string[] = [];
  const fetchedAt = new Date("2026-08-10T03:00:00.000Z");
  const result = await prepareCalendarSourceUrlReplacement(
    { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: "https://ical.booking.com/v1/export?t=new-secret" },
    {
      findSource: async () => { calls.push("find-source"); return { id: "source-existing", roomId: "room-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old-secret" }; },
      validateUrl: (_provider, value) => { calls.push("provider-url-validation"); return value; },
      hasDuplicate: async () => { calls.push("duplicate-check"); return false; },
      inspect: async () => { calls.push("fetch-parse-classify-safety"); return { normalizedUrl: "https://ical.booking.com/v1/export?t=new-secret", fingerprint, syncSafetyStatus: "SAFE", safetyDiagnostics, fetchedAt }; },
    },
  );
  assert.deepEqual(calls, ["find-source", "provider-url-validation", "duplicate-check", "fetch-parse-classify-safety"]);
  assert.deepEqual({ id: result.calendarSourceId, roomId: result.roomId, provider: result.provider, companyId: result.companyId }, { id: "source-existing", roomId: "room-1", provider: "BOOKING", companyId: "company-1" });
  assert.equal(result.calendarUrl, "https://ical.booking.com/v1/export?t=new-secret");
  assert.equal(result.fingerprint, fingerprint);
  assert.equal(result.syncSafetyStatus, "SAFE");
  assert.equal(result.baselineAt, fetchedAt);
});

test("정상 빈 Booking VCALENDAR는 Provider identity가 없어도 연결 검증을 통과한다", () => {
  assert.deepEqual(
    validateCalendarFeedConnection({ provider: "BOOKING", fetchedEventCount: 0, counts: emptyCounts, fingerprint: emptyFingerprint }),
    { valid: true },
  );
});

test("기존 활성 예약이 있는 빈 feed의 sync quarantine은 URL 교체를 막지 않는다", async () => {
  const diagnostics: CalendarFeedSafetyDiagnostics = { ...safetyDiagnostics, reasonCodes: ["EMPTY_FEED_WITH_ACTIVE_RESERVATIONS"] };
  const result = await prepareCalendarSourceUrlReplacement(
    { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: "https://ical.booking.com/v1/export?t=empty" },
    {
      findSource: async () => ({ id: "source-existing", roomId: "room-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old" }),
      validateUrl: (_provider, value) => value,
      hasDuplicate: async () => false,
      inspect: async () => ({ normalizedUrl: "https://ical.booking.com/v1/export?t=empty", fingerprint: emptyFingerprint, syncSafetyStatus: "QUARANTINED", safetyDiagnostics: diagnostics, fetchedAt: new Date("2026-08-10T03:00:00.000Z") }),
    },
  );
  assert.equal(result.calendarSourceId, "source-existing");
  assert.equal(result.calendarUrl, "https://ical.booking.com/v1/export?t=empty");
  assert.equal(result.syncSafetyStatus, "QUARANTINED");
  assert.deepEqual(result.safetyDiagnostics.reasonCodes, ["EMPTY_FEED_WITH_ACTIVE_RESERVATIONS"]);
});

test("기존 예약이 없는 빈 feed는 URL 교체 허용 상태다", async () => {
  const result = await prepareCalendarSourceUrlReplacement(
    { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: "https://ical.booking.com/v1/export?t=empty-safe" },
    {
      findSource: async () => ({ id: "source-existing", roomId: "room-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old" }),
      validateUrl: (_provider, value) => value,
      hasDuplicate: async () => false,
      inspect: async () => ({ normalizedUrl: "https://ical.booking.com/v1/export?t=empty-safe", fingerprint: emptyFingerprint, syncSafetyStatus: "SAFE", safetyDiagnostics: { ...safetyDiagnostics, reasonCodes: [], existingFutureReservationCount: 0, baselineReservationCount: 0, incomingReservationCount: 0 }, fetchedAt: new Date() }),
    },
  );
  assert.equal(result.syncSafetyStatus, "SAFE");
});

for (const failure of ["DOWNLOAD_FAILED", "PARSE_FAILED"] as const) {
  test(`${failure}이면 URL 교체 준비가 실패하고 저장 단계로 진행하지 않는다`, async () => {
    await assert.rejects(() => prepareCalendarSourceUrlReplacement(
      { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: `https://ical.booking.com/v1/export?t=${failure}` },
      {
        findSource: async () => ({ id: "source-existing", roomId: "room-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old" }),
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
