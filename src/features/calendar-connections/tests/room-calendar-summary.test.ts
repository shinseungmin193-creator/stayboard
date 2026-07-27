import test from "node:test";
import assert from "node:assert/strict";
import { getRoomCalendarStatus } from "../lib/get-room-calendar-status";
import { isCalendarSyncWarning } from "../../calendar-sync/domain/sync-health";
import { mapRoomCalendarSummary, type RoomCalendarMapperInput } from "../lib/map-room-calendar-summary";

test("최신 SyncRun의 동일한 숫자로 통합 상태를 계산한다", () => {
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, targetCount: 3, successCount: 3, failedCount: 0 }), "HEALTHY");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, targetCount: 3, successCount: 2, failedCount: 1 }), "PARTIAL_FAILURE");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, targetCount: 3, successCount: 0, failedCount: 3 }), "FAILED");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 0 }), "DISABLED");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, running: true }), "SYNCING");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, targetCount: 3, successCount: 3, failedCount: 0, warning: true }), "WARNING");
});

test("다운로드 이벤트가 전부 UNKNOWN 또는 파싱 실패면 성공 대신 주의 상태다", () => {
  assert.equal(isCalendarSyncWarning({ status: "SUCCESS", fetchedEventCount: 3, reservationEventCount: 0, blockedEventCount: 0, cancelledEventCount: 0, unknownEventCount: 2, failedEventCount: 1 }), true);
  assert.equal(isCalendarSyncWarning({ status: "SUCCESS", fetchedEventCount: 3, reservationEventCount: 1, blockedEventCount: 0, cancelledEventCount: 0, unknownEventCount: 2, failedEventCount: 0 }), false);
});

const log = (calendarSourceId: string, provider: "AIRBNB" | "BOOKING" | "AGODA", status: "SUCCESS" | "FAILED", errorMessage: string | null = null) => ({ calendarSourceId, provider, status, startedAt: new Date("2026-07-24T14:25:00Z"), completedAt: new Date("2026-07-24T14:25:01Z"), fetchedCount: status === "SUCCESS" ? 5 : 0, reservationEventCount: status === "SUCCESS" ? 3 : 0, blockedEventCount: status === "SUCCESS" ? 2 : 0, cancelledEventCount: 0, unknownEventCount: 0, failedEventCount: 0, createdCount: status === "SUCCESS" ? 3 : 0, updatedCount: 0, cancelledCount: 0, retryCount: status === "FAILED" ? 2 : 0, httpStatus: status === "FAILED" ? 403 : null, errorCode: status === "FAILED" ? "ICS_HTTP_403" : null, errorMessage, errorDetails: status === "FAILED" ? "technical upstream response" : null, durationMs: 1000 });

function row(): RoomCalendarMapperInput {
  return { id: "room-303", name: "303호", propertyId: "property-1", property: { name: "테스트 숙소" }, calendarSources: [
    { id: "a", provider: "AIRBNB", name: "Airbnb", calendarUrl: "https://example.com/super-secret-a-token.ics", isActive: true, lastSyncedAt: new Date("2026-07-24T14:25:01Z") },
    { id: "b", provider: "BOOKING", name: "Booking", calendarUrl: "https://example.com/super-secret-b-token.ics", isActive: true, lastSyncedAt: null },
  ], syncRuns: [
    { id: "latest", status: "SUCCESS", executionMode: "MANUAL", startedAt: new Date("2026-07-24T14:25:00Z"), finishedAt: new Date("2026-07-24T14:25:01Z"), targetCount: 2, successCount: 2, failedCount: 0, errorSummary: null, actor: { name: "관리자" }, syncLogs: [log("a", "AIRBNB", "SUCCESS"), log("b", "BOOKING", "SUCCESS")] },
    { id: "past", status: "FAILED", executionMode: "AUTO", startedAt: new Date("2026-07-23T14:25:00Z"), finishedAt: new Date("2026-07-23T14:25:01Z"), targetCount: 2, successCount: 1, failedCount: 1, errorSummary: "Booking.com 오류", actor: null, syncLogs: [log("a", "AIRBNB", "SUCCESS"), log("b", "BOOKING", "FAILED", "접근할 수 없습니다.")] },
  ], _count: { reservations: 2 }, conflicts: [] };
}

test("과거 실패가 있어도 최신 실행이 모두 성공이면 현재 상태는 정상이다", () => {
  const result = mapRoomCalendarSummary(row());
  assert.equal(result.status, "HEALTHY"); assert.deepEqual(result.latestRun && [result.latestRun.targetCount, result.latestRun.successCount, result.latestRun.failedCount], [2, 2, 0]);
  assert.equal(result.history[0].executionMode, "MANUAL"); assert.equal(result.history[1].executionMode, "AUTO"); assert.doesNotMatch(result.sources[0].maskedUrl, /super-secret-a-token/);
});

test("최신 CalendarSource가 전부 UNKNOWN이면 객실과 소스에 주의를 표시한다", () => {
  const input = row();
  input.syncRuns[0].syncLogs[1] = { ...log("b", "BOOKING", "SUCCESS"), reservationEventCount: 0, blockedEventCount: 0, unknownEventCount: 5, createdCount: 0 };
  const result = mapRoomCalendarSummary(input);
  assert.equal(result.status, "WARNING");
  assert.equal(result.sources[1].isWarning, true);
});

test("실패 Provider와 안전한 오류는 노출하고 기술 상세는 DEVELOPER에게만 제공한다", () => {
  const input = row(); input.syncRuns = [input.syncRuns[1]];
  const staff = mapRoomCalendarSummary(input, new Date(), false); const developer = mapRoomCalendarSummary(input, new Date(), true);
  assert.equal(staff.status, "PARTIAL_FAILURE"); assert.equal(staff.failureSummaries[0].provider, "BOOKING"); assert.equal(staff.sources[1].latestErrorDetails, null); assert.equal(developer.sources[1].latestErrorDetails, "technical upstream response");
});
