import test from "node:test";
import assert from "node:assert/strict";
import { CalendarSourceUrlReplacementPreparationError, prepareCalendarSourceUrlReplacement } from "../domain/calendar-source-url-replacement";
import type { CalendarFeedFingerprint } from "../../calendar-sync/domain/calendar-feed-fingerprint";
import type { CalendarFeedSafetyDiagnostics } from "../../calendar-sync/domain/calendar-feed-safety";

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

test("Booking URL 직접 교체는 전체 검증 후 기존 CalendarSource ID·Provider·Room을 유지하고 새 baseline을 만든다", async () => {
  const calls: string[] = [];
  const fetchedAt = new Date("2026-08-10T03:00:00.000Z");
  const result = await prepareCalendarSourceUrlReplacement(
    { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: "https://ical.booking.com/v1/export?t=new-secret" },
    {
      findSource: async () => { calls.push("find-source"); return { id: "source-existing", roomId: "room-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old-secret" }; },
      validateUrl: (_provider, value) => { calls.push("provider-url-validation"); return value; },
      hasDuplicate: async () => { calls.push("duplicate-check"); return false; },
      inspect: async () => { calls.push("fetch-parse-classify-safety"); return { normalizedUrl: "https://ical.booking.com/v1/export?t=new-secret", fingerprint, safetyStatus: "SAFE", safetyDiagnostics, fetchedAt }; },
    },
  );
  assert.deepEqual(calls, ["find-source", "provider-url-validation", "duplicate-check", "fetch-parse-classify-safety"]);
  assert.deepEqual({ id: result.calendarSourceId, roomId: result.roomId, provider: result.provider, companyId: result.companyId }, { id: "source-existing", roomId: "room-1", provider: "BOOKING", companyId: "company-1" });
  assert.equal(result.calendarUrl, "https://ical.booking.com/v1/export?t=new-secret");
  assert.equal(result.fingerprint, fingerprint);
  assert.equal(result.baselineAt, fetchedAt);
});

test("새 URL safety validation이 quarantine이면 교체 준비를 중단한다", async () => {
  await assert.rejects(
    () => prepareCalendarSourceUrlReplacement(
      { calendarSourceId: "source-existing", expectedRoomId: "room-1", submittedUrl: "https://ical.booking.com/v1/export?t=unsafe" },
      {
        findSource: async () => ({ id: "source-existing", roomId: "room-1", companyId: "company-1", provider: "BOOKING", calendarUrl: "https://ical.booking.com/v1/export?t=old" }),
        validateUrl: (_provider, value) => value,
        hasDuplicate: async () => false,
        inspect: async () => ({ normalizedUrl: "https://ical.booking.com/v1/export?t=unsafe", fingerprint, safetyStatus: "QUARANTINED", safetyDiagnostics: { ...safetyDiagnostics, reasonCodes: ["UID_NAMESPACE_DRIFT"] }, fetchedAt: new Date() }),
      },
    ),
    (error: unknown) => error instanceof CalendarSourceUrlReplacementPreparationError && error.code === "FEED_QUARANTINED",
  );
});
