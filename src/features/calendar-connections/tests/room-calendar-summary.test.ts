import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRoomCalendarStatus } from "../lib/get-room-calendar-status";
import { isCalendarSyncWarning } from "../../calendar-sync/domain/sync-health";
import { mapRoomCalendarSummary, type RoomCalendarMapperInput } from "../lib/map-room-calendar-summary";
import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import { isCalendarSourceDeleteConfirmationValid, isCalendarSourceSyncRunning } from "../../calendar-sources/domain/calendar-source-deletion";

test("최신 SyncRun의 동일한 숫자로 통합 상태를 계산한다", () => {
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, targetCount: 3, successCount: 3, failedCount: 0 }), "HEALTHY");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, targetCount: 3, successCount: 2, failedCount: 1 }), "PARTIAL_FAILURE");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, targetCount: 3, successCount: 0, failedCount: 3 }), "FAILED");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 0 }), "DISABLED");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, running: true }), "SYNCING");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, reconnectRequired: true }), "RECONNECT_REQUIRED");
  assert.equal(getRoomCalendarStatus({ activeSourceCount: 3, targetCount: 3, successCount: 3, failedCount: 0, warning: true }), "WARNING");
});

test("다운로드 이벤트가 전부 UNKNOWN 또는 파싱 실패면 성공 대신 주의 상태다", () => {
  assert.equal(isCalendarSyncWarning({ status: "SUCCESS", fetchedEventCount: 3, reservationEventCount: 0, blockedEventCount: 0, cancelledEventCount: 0, unknownEventCount: 2, failedEventCount: 1 }), true);
  assert.equal(isCalendarSyncWarning({ status: "SUCCESS", fetchedEventCount: 3, reservationEventCount: 1, blockedEventCount: 0, cancelledEventCount: 0, unknownEventCount: 2, failedEventCount: 0 }), false);
});

const log = (calendarSourceId: string, provider: "AIRBNB" | "BOOKING" | "AGODA", status: "SUCCESS" | "FAILED", errorMessage: string | null = null) => ({ calendarSourceId, provider, status, startedAt: new Date("2026-07-24T14:25:00Z"), completedAt: new Date("2026-07-24T14:25:01Z"), fetchedCount: status === "SUCCESS" ? 5 : 0, reservationEventCount: status === "SUCCESS" ? 3 : 0, blockedEventCount: status === "SUCCESS" ? 2 : 0, cancelledEventCount: 0, unknownEventCount: 0, failedEventCount: 0, createdCount: status === "SUCCESS" ? 3 : 0, updatedCount: 0, cancelledCount: 0, retryCount: status === "FAILED" ? 2 : 0, httpStatus: status === "FAILED" ? 403 : null, errorCode: status === "FAILED" ? "ICS_HTTP_403" : null, errorMessage, errorDetails: status === "FAILED" ? "technical upstream response" : null, durationMs: 1000 });

function row(): RoomCalendarMapperInput {
  return { id: "room-303", name: "303호", propertyId: "property-1", property: { name: "테스트 숙소" }, calendarSources: [
    { id: "a", provider: "AIRBNB", name: "Airbnb", calendarUrl: "https://example.com/super-secret-a-token.ics", isActive: true, connectionStatus: "NORMAL", safetyReasonCodes: null, lastSyncedAt: new Date("2026-07-24T14:25:01Z") },
    { id: "b", provider: "BOOKING", name: "Booking", calendarUrl: "https://example.com/super-secret-b-token.ics", isActive: true, connectionStatus: "NORMAL", safetyReasonCodes: null, lastSyncedAt: null },
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

test("활성 Source가 격리되면 객실도 연결 갱신 필요 상태이며 reason code는 개발자에게만 보인다", () => {
  const input = row();
  input.calendarSources[1].connectionStatus = "RECONNECT_REQUIRED";
  input.calendarSources[1].safetyReasonCodes = ["UID_NAMESPACE_DRIFT"];
  const staff = mapRoomCalendarSummary(input, new Date(), false);
  const developer = mapRoomCalendarSummary(input, new Date(), true);
  assert.equal(staff.status, "RECONNECT_REQUIRED");
  assert.deepEqual(staff.sources[1].safetyReasonCodes, []);
  assert.deepEqual(developer.sources[1].safetyReasonCodes, ["UID_NAMESPACE_DRIFT"]);
});

test("실패 Provider와 안전한 오류는 노출하고 기술 상세는 DEVELOPER에게만 제공한다", () => {
  const input = row(); input.syncRuns = [input.syncRuns[1]];
  const staff = mapRoomCalendarSummary(input, new Date(), false); const developer = mapRoomCalendarSummary(input, new Date(), true);
  assert.equal(staff.status, "PARTIAL_FAILURE"); assert.equal(staff.failureSummaries[0].provider, "BOOKING"); assert.equal(staff.sources[1].latestErrorDetails, null); assert.equal(developer.sources[1].latestErrorDetails, "technical upstream response");
});

test("캘린더 연결 삭제 권한은 effective role이 ADMIN 또는 DEVELOPER일 때만 허용한다", () => {
  assert.equal(hasPermission("DEVELOPER", PERMISSIONS.CALENDAR_SOURCE_MANAGE), true);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.CALENDAR_SOURCE_MANAGE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CALENDAR_SOURCE_MANAGE), false);
});

test("현재 언어의 삭제 확인어를 정확히 입력해야 최종 삭제를 허용한다", () => {
  assert.equal(isCalendarSourceDeleteConfirmationValid(" 삭제 "), true);
  assert.equal(isCalendarSourceDeleteConfirmationValid("削除"), true);
  assert.equal(isCalendarSourceDeleteConfirmationValid("Booking.com"), false);
  assert.equal(isCalendarSourceDeleteConfirmationValid("delete"), false);
});

test("최근 RUNNING 로그만 실제 동기화 중으로 판정한다", () => {
  const now = new Date("2026-08-04T12:00:00Z");
  assert.equal(isCalendarSourceSyncRunning(new Date("2026-08-04T11:45:00Z"), now, 30 * 60 * 1000), true);
  assert.equal(isCalendarSourceSyncRunning(new Date("2026-08-04T11:20:00Z"), now, 30 * 60 * 1000), false);
  assert.equal(isCalendarSourceSyncRunning(null, now, 30 * 60 * 1000), false);
});

test("삭제 트랜잭션은 공통 source-scoped 제거 정책으로 파생 데이터를 정리한다", () => {
  const repository = readFileSync("src/features/calendar-sources/calendar-source.repository.ts", "utf8");
  const removal = readFileSync("src/features/calendar-sync/infrastructure/calendar-source-reservation-removal.ts", "utf8");
  const start = repository.indexOf("export async function deleteCalendarSourceTransaction");
  const end = repository.indexOf("export function findCalendarRoom", start);
  const deletion = repository.slice(start, end);
  const steps = [
    "tx.calendarSource.update",
    "removeCalendarSourceReservations",
    "tx.syncLog.deleteMany",
    "tx.calendarSource.delete",
    "tx.auditLog.create",
  ].map((step) => deletion.indexOf(step));
  assert.ok(steps.every((position) => position >= 0));
  assert.deepEqual([...steps].sort((a, b) => a - b), steps);
  assert.match(deletion, /removeCalendarSourceReservations\(tx, \{ calendarSourceId: source\.id \}\)/);
  assert.match(removal, /reservationConflict\.deleteMany/);
  assert.match(removal, /cleaningTask\.deleteMany/);
  assert.match(removal, /status: "CANCELLED", reservationId: null/);
  assert.match(removal, /calendarSourceId: input\.calendarSourceId/);
  assert.match(deletion, /action: "CALENDAR_SOURCE_DELETED"/);
  assert.doesNotMatch(deletion, /calendarUrl/);
});

test("동기화 엔진은 advisory lock 획득 후 source 존재와 활성 상태를 다시 확인한다", () => {
  const syncSource = readFileSync("src/features/calendar-sync/application/sync-calendar-source.ts", "utf8");
  const lock = syncSource.indexOf("withCalendarSourceAdvisoryLock");
  const reload = syncSource.indexOf("findCalendarSourceForSync(calendarSourceId)", lock);
  const activeCheck = syncSource.indexOf("if (!source.isActive)", reload);
  const runningLog = syncSource.indexOf("createRunningSyncLog", activeCheck);
  assert.ok(lock >= 0 && reload > lock && activeCheck > reload && runningLog > activeCheck);
});

test("삭제 UI는 권한 prop, 영향 count, 확인 입력과 한일 메시지를 포함한다", () => {
  const card = readFileSync("src/features/calendar-connections/components/calendar-source-card.tsx", "utf8");
  const dialog = readFileSync("src/features/calendar-sources/components/calendar-source-delete-dialog.tsx", "utf8");
  const ko = JSON.parse(readFileSync("src/messages/ko.json", "utf8")).calendarSourceDeletion;
  const ja = JSON.parse(readFileSync("src/messages/ja.json", "utf8")).calendarSourceDeletion;
  assert.match(card, /canManage && onSourceDeleted/);
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /impact\.reservationCount/);
  assert.match(dialog, /confirmationValid/);
  assert.equal(ko.title, "캘린더 연결을 삭제하시겠습니까?");
  assert.equal(ja.title, "カレンダー連携を削除しますか？");
});

test("상세 패널의 현재 상태와 연결 탭 모두 카드 헤더에서 수정·URL 변경·삭제를 제공한다", () => {
  const detail = readFileSync("src/features/calendar-connections/components/room-calendar-detail-sheet.tsx", "utf8");
  const card = readFileSync("src/features/calendar-connections/components/calendar-source-card.tsx", "utf8");
  const list = readFileSync("src/features/calendar-connections/components/room-calendar-list.tsx", "utf8");
  assert.doesNotMatch(detail, /showActions=\{false\}/);
  assert.match(detail, /onSourceUpdated=\{onSourceUpdated\}/);
  assert.match(card, /data-calendar-source-management/);
  assert.match(card, /<CalendarSourceForm[^>]+onSaved=\{onSourceUpdated\}/);
  assert.match(card, /<CalendarSourceUrlReplaceDialog[^>]+onUpdated=\{onSourceUpdated\}/);
  assert.match(card, /<CalendarSourceDeleteDialog[^>]+showButtonLabelOnMobile/);
  assert.match(card, /flex w-full flex-wrap items-center gap-2/);
  assert.match(list, /handleSourceUpdated/);
  assert.match(list, /router\.refresh|onSourceUpdated/);
});

test("수정 성공 후 패널 데이터를 갱신하고 Provider 변경은 UI와 서버에서 모두 차단한다", () => {
  const form = readFileSync("src/features/calendar-sources/components/calendar-source-form.tsx", "utf8");
  const urlDialog = readFileSync("src/features/calendar-sources/components/calendar-source-url-replace-dialog.tsx", "utf8");
  const service = readFileSync("src/features/calendar-sources/calendar-source.service.ts", "utf8");
  assert.match(form, /disabled=\{Boolean\(source\)\}/);
  assert.match(form, /type="hidden" name="provider" value=\{source\.provider\}/);
  assert.match(form, /onSaved\?\.\(result\.message/);
  assert.match(form, /router\.refresh\(\)/);
  assert.match(urlDialog, /onUpdated\?\.\(result\.message/);
  assert.match(urlDialog, /router\.refresh\(\)/);
  assert.match(service, /existing\.provider !== input\.provider/);
  assert.match(service, /Provider는 변경할 수 없습니다/);
});

test("수정·삭제 Server Action은 CalendarSource와 대상 Room 권한을 각각 다시 검증한다", () => {
  const actions = readFileSync("src/features/calendar-sources/calendar-source.actions.ts", "utf8");
  const updateStart = actions.indexOf("export async function updateCalendarSourceAction");
  const updateEnd = actions.indexOf("export async function replaceCalendarSourceUrlAction", updateStart);
  const update = actions.slice(updateStart, updateEnd);
  const deleteStart = actions.indexOf("export async function deleteCalendarSourceAction");
  const deletion = actions.slice(deleteStart);
  assert.match(update, /requireCalendarSourceAccess\(id, PERMISSIONS\.CALENDAR_SOURCE_MANAGE\)/);
  assert.match(update, /requireRoomAccess\(data\.roomId, PERMISSIONS\.CALENDAR_SOURCE_MANAGE\)/);
  assert.match(deletion, /requireCalendarSourceAccess\(parsed\.data\.calendarSourceId, PERMISSIONS\.CALENDAR_SOURCE_MANAGE\)/);
  assert.match(deletion, /requireRoomAccess\(target\.roomId, PERMISSIONS\.CALENDAR_SOURCE_MANAGE\)/);
});

test("삭제 성공 전에는 로컬 목록을 변경하지 않고 성공 시 해당 source ID만 숨긴다", () => {
  const list = readFileSync("src/features/calendar-connections/components/room-calendar-list.tsx", "utf8");
  const dialog = readFileSync("src/features/calendar-sources/components/calendar-source-delete-dialog.tsx", "utf8");
  const repository = readFileSync("src/features/calendar-sources/calendar-source.repository.ts", "utf8");
  assert.match(dialog, /if \(!result\.success\)/);
  assert.match(dialog, /onDeleted\(source\.id/);
  assert.match(list, /new Set\(current\)\.add\(calendarSourceId\)/);
  assert.match(list, /sources\.filter\(\(source\) => !deletedSourceIds\.has\(source\.id\)\)/);
  assert.match(repository, /tx\.calendarSource\.delete\(\{ where: \{ id: source\.id \} \}\)/);
  assert.doesNotMatch(repository, /tx\.calendarSource\.deleteMany/);
});

test("객실 수정 OTA 연결 행에 연결 해제와 실제 삭제가 함께 렌더링된다", () => {
  const editor = readFileSync("src/features/rooms/components/room-calendar-source-editor.tsx", "utf8");
  const roomDialog = readFileSync("src/features/rooms/components/room-form-dialog.tsx", "utf8");
  const roomsPage = readFileSync("src/app/rooms/page.tsx", "utf8");
  const actions = readFileSync("src/features/calendar-sources/calendar-source.actions.ts", "utf8");
  assert.match(editor, /CalendarSourceDeleteDialog/);
  assert.match(editor, /i18n\("auto\.m0565"\)/);
  assert.match(editor, /canDelete && <CalendarSourceDeleteDialog/);
  assert.match(editor, /flex flex-wrap items-center justify-end gap-2/);
  assert.match(editor, /calendarSourceDeletion\.emptyProvider/);
  assert.match(editor, /changeCalendarSourceActiveAction/);
  assert.match(roomDialog, /<RoomCalendarSourceEditor[^>]+canManageCalendarSources/);
  assert.match(roomDialog, /removeExistingCalendarSourceDraft/);
  assert.match(roomsPage, /hasPermission\(access\.context\.role, PERMISSIONS\.CALENDAR_SOURCE_MANAGE\)/);
  assert.match(actions, /revalidatePath\("\/rooms"\)/);
});
