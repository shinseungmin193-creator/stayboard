import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CalendarDraftConnectionResult } from "../../calendar-sources/calendar-source.types";
import {
  calendarSourceDraftSubmitErrors,
  createCalendarSourceClientId,
  createInitialCalendarSourceDrafts,
  createNewCalendarSourceDraft,
  removeExistingCalendarSourceDraft,
  removeNewCalendarSourceDraft,
  updateCalendarSourceDraftByKey,
  type CalendarSourceDraft,
} from "../room-calendar-source-draft";
import {
  updateRoomWithCalendarSources,
  UpdateRoomCalendarError,
  type CurrentRoomForCalendarUpdate,
  type RoomWithCalendarSourcesAtomicInput,
  type UpdateRoomWithCalendarSourcesInput,
} from "../update-room-with-calendar-sources";

const oldUrl = "https://www.airbnb.com/calendar/ical/old.ics";
const newUrl = "https://www.airbnb.com/calendar/ical/new.ics";
const bookingUrl = "https://ical.booking.com/v1/export?t=booking";
const secondBookingUrl = "https://ical.booking.com/v1/export?t=booking-2";
const agodaUrl = "https://ycs.agoda.com/a.ics";
const secondAgodaUrl = "https://ycs.agoda.com/b.ics";
const currentRoom: CurrentRoomForCalendarUpdate = {
  id: "room-1",
  sources: [{ id: "source-1", provider: "AIRBNB", name: "Airbnb", calendarUrl: oldUrl, isActive: true }],
};
const result = (provider: "AIRBNB" | "BOOKING" | "AGODA", url: string): CalendarDraftConnectionResult => ({
  provider,
  submittedUrl: url,
  normalizedUrl: url,
  responseTimeMs: 1,
  fetchedAt: new Date(0).toISOString(),
  contentType: "text/calendar",
  eventCount: 1,
  uidCount: 1,
  startCount: 1,
  endCount: 1,
  summaryCount: 1,
  reservationCount: 1,
  blockedCount: 0,
  cancelledCount: 0,
  unknownCount: 0,
});
const existingDraft = (overrides: Partial<Extract<UpdateRoomWithCalendarSourcesInput["sources"][number], { kind: "existing" }>> = {}) => ({
  kind: "existing" as const,
  clientKey: "existing:source-1",
  id: "source-1",
  provider: "AIRBNB" as const,
  name: "Airbnb",
  calendarUrl: oldUrl,
  isActive: true,
  markedForDeletion: false,
  testedCalendarUrl: "",
  ...overrides,
});
const input = (sources: UpdateRoomWithCalendarSourcesInput["sources"] = [existingDraft()]): UpdateRoomWithCalendarSourcesInput => ({
  id: "room-1",
  propertyId: "property-1",
  name: "303호",
  capacity: 4,
  sources,
});
type Dependencies = Parameters<typeof updateRoomWithCalendarSources>[1];
function dependencies(overrides: Partial<Dependencies> = {}) {
  let atomicInput: RoomWithCalendarSourcesAtomicInput | null = null;
  let testCount = 0;
  const deps: Dependencies = {
    findRoom: async () => currentRoom,
    propertyExists: async () => ({ id: "property-1" }),
    testConnection: async (provider, url) => { testCount += 1; return result(provider, url); },
    normalizeUrl: (url) => { const parsed = new URL(url); parsed.hash = ""; return parsed.toString(); },
    updateAtomically: async (value) => { atomicInput = value; return { id: value.room.id }; },
    ...overrides,
  };
  return { deps, getAtomicInput: () => atomicInput, getTestCount: () => testCount };
}

test("기존 Source 변경 없이 Room 기본정보만 수정한다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources({ ...input(), name: "303호 수정", capacity: 5 }, fixture.deps);
  assert.equal(fixture.getTestCount(), 0);
  assert.equal(fixture.getAtomicInput()?.room.name, "303호 수정");
  assert.equal(fixture.getAtomicInput()?.sourceUpdates[0].calendarUrl, oldUrl);
});

test("기존 Source URL 변경은 전용 URL 갱신 흐름으로만 허용한다", async () => {
  const fixture = dependencies();
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft({ calendarUrl: newUrl, testedCalendarUrl: newUrl })]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "URL_CHANGE_REQUIRES_REFRESH");
  assert.equal(fixture.getTestCount(), 0);
  assert.equal(fixture.getAtomicInput(), null);
});

test("기존 Source URL 변경은 테스트 여부와 무관하게 객실 편집에서 차단한다", async () => {
  const fixture = dependencies();
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft({ calendarUrl: newUrl })]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "URL_CHANGE_REQUIRES_REFRESH");
  assert.equal(fixture.getAtomicInput(), null);
});

test("기존 Source URL 변경은 기존 테스트 의존성을 호출하지 않는다", async () => {
  const fixture = dependencies({ testConnection: async () => { throw new Error("HTTP 400"); } });
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft({ calendarUrl: newUrl, testedCalendarUrl: newUrl })]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "URL_CHANGE_REQUIRES_REFRESH");
  assert.equal(fixture.getTestCount(), 0);
  assert.equal(fixture.getAtomicInput(), null);
});

test("신규 Airbnb Source를 추가한다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources(input([existingDraft(), { kind: "new", clientKey: "new:1", provider: "AIRBNB", name: "", calendarUrl: newUrl, isActive: true, testedCalendarUrl: newUrl }]), fixture.deps);
  assert.equal(fixture.getAtomicInput()?.sourceCreates.length, 1);
  assert.equal(fixture.getAtomicInput()?.sourceCreates[0].name, "303호 Airbnb 2");
});

test("여러 신규 Provider Source를 함께 추가한다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources(input([
    existingDraft(),
    { kind: "new", clientKey: "new:booking", provider: "BOOKING", name: "", calendarUrl: bookingUrl, isActive: true, testedCalendarUrl: bookingUrl },
    { kind: "new", clientKey: "new:agoda", provider: "AGODA", name: "Agoda 연결", calendarUrl: "https://ycs.agoda.com/a.ics", isActive: true, testedCalendarUrl: "https://ycs.agoda.com/a.ics" },
  ]), fixture.deps);
  assert.deepEqual(fixture.getAtomicInput()?.sourceCreates.map((source) => source.provider), ["BOOKING", "AGODA"]);
});

test("동일 Provider의 서로 다른 URL을 여러 개 한 transaction payload로 저장한다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources(input([
    existingDraft(),
    { kind: "new", clientKey: "new:airbnb-2", provider: "AIRBNB", name: "", calendarUrl: newUrl, isActive: true, testedCalendarUrl: newUrl },
    { kind: "new", clientKey: "new:airbnb-3", provider: "AIRBNB", name: "", calendarUrl: "https://www.airbnb.com/calendar/ical/third.ics", isActive: true, testedCalendarUrl: "https://www.airbnb.com/calendar/ical/third.ics" },
    { kind: "new", clientKey: "new:booking-1", provider: "BOOKING", name: "", calendarUrl: bookingUrl, isActive: true, testedCalendarUrl: bookingUrl },
    { kind: "new", clientKey: "new:booking-2", provider: "BOOKING", name: "", calendarUrl: secondBookingUrl, isActive: true, testedCalendarUrl: secondBookingUrl },
    { kind: "new", clientKey: "new:agoda-1", provider: "AGODA", name: "", calendarUrl: agodaUrl, isActive: true, testedCalendarUrl: agodaUrl },
    { kind: "new", clientKey: "new:agoda-2", provider: "AGODA", name: "", calendarUrl: secondAgodaUrl, isActive: true, testedCalendarUrl: secondAgodaUrl },
  ]), fixture.deps);

  const creates = fixture.getAtomicInput()?.sourceCreates ?? [];
  assert.deepEqual(creates.map((source) => source.provider), ["AIRBNB", "AIRBNB", "BOOKING", "BOOKING", "AGODA", "AGODA"]);
  assert.deepEqual(creates.map((source) => source.name), [
    "303호 Airbnb 2",
    "303호 Airbnb 3",
    "303호 Booking.com",
    "303호 Booking.com 2",
    "303호 Agoda",
    "303호 Agoda 2",
  ]);
});

test("연결 해제는 Source를 비활성화하고 URL과 이름을 보존한다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources(input([existingDraft({ name: "조작된 이름", calendarUrl: newUrl, markedForDeletion: true })]), fixture.deps);
  assert.deepEqual(fixture.getAtomicInput()?.sourceUpdates[0], { id: "source-1", name: "Airbnb", calendarUrl: oldUrl, isActive: false });
  assert.equal(fixture.getTestCount(), 0);
});

test("Room 저장 실패 시 CalendarSource 변경 결과를 반환하지 않는다", async () => {
  const fixture = dependencies({ updateAtomically: async () => { throw new Error("room rollback"); } });
  await assert.rejects(() => updateRoomWithCalendarSources(input(), fixture.deps,));
});

test("CalendarSource 생성 실패 시 Room 수정도 성공 처리하지 않는다", async () => {
  const fixture = dependencies({ updateAtomically: async () => { throw new Error("source rollback"); } });
  await assert.rejects(() => updateRoomWithCalendarSources(input([{ kind: "new", clientKey: "new:1", provider: "AIRBNB", name: "Airbnb", calendarUrl: newUrl, isActive: true, testedCalendarUrl: newUrl }]), fixture.deps));
});

test("정규화된 중복 URL을 차단한다", async () => {
  const fixture = dependencies();
  const duplicate = `${oldUrl}#fragment`;
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft(), { kind: "new", clientKey: "new:1", provider: "AIRBNB", name: "중복", calendarUrl: duplicate, isActive: true, testedCalendarUrl: duplicate }]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "DUPLICATE");
});

test("빈 신규 Source는 무시한다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources(input([existingDraft(), { kind: "new", clientKey: "new:1", provider: "AIRBNB", name: "", calendarUrl: " ", isActive: true, testedCalendarUrl: "" }]), fixture.deps);
  assert.equal(fixture.getAtomicInput()?.sourceCreates.length, 0);
});

test("Source URL 변경 시 이전 테스트 상태를 저장 증명으로 사용하지 않는다", () => {
  const [draft] = createInitialCalendarSourceDrafts([{ id: "source-1", provider: "AIRBNB", name: "Airbnb", calendarUrl: oldUrl, isActive: true, lastSyncedAt: null, latestSyncStatus: null, latestSyncStartedAt: null, latestSyncCompletedAt: null, latestFetchedCount: 0, latestErrorSummary: null, isSyncing: false }]);
  if (draft.kind !== "existing") throw new Error("existing draft expected");
  const changed = { ...draft, url: newUrl, testState: { status: "success" as const, testedUrl: oldUrl, result: result("AIRBNB", oldUrl) } };
  assert.deepEqual(calendarSourceDraftSubmitErrors([changed])[draft.key], ["기존 iCal URL은 캘린더 연결 화면의 'URL 갱신' 기능으로 변경해 주세요."]);
});

test("기존 Source URL이 같으면 재테스트를 강제하지 않는다", async () => {
  const fixture = dependencies({ testConnection: async () => { throw new Error("호출되면 안 됨"); } });
  await updateRoomWithCalendarSources(input(), fixture.deps);
  assert.equal(fixture.getAtomicInput()?.sourceUpdates.length, 1);
});

test("기존 Source Provider 변경을 차단한다", async () => {
  const fixture = dependencies();
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft({ provider: "BOOKING" })]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "PROVIDER_MISMATCH");
});

test("연결 테스트 결과 Provider 불일치를 차단한다", async () => {
  const fixture = dependencies({ testConnection: async (_provider, url) => result("BOOKING", url) });
  const added = { kind: "new" as const, clientKey: "new:provider-mismatch", provider: "AIRBNB" as const, name: "Airbnb", calendarUrl: newUrl, isActive: true as const, testedCalendarUrl: newUrl };
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft(), added]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "PROVIDER_MISMATCH");
});

test("SSRF 차단 연결 테스트 실패를 저장 실패로 전달한다", async () => {
  const fixture = dependencies({ testConnection: async () => { throw new Error("공개 인터넷 주소만 사용할 수 있습니다."); } });
  const added = { kind: "new" as const, clientKey: "new:ssrf", provider: "AIRBNB" as const, name: "Airbnb", calendarUrl: newUrl, isActive: true as const, testedCalendarUrl: newUrl };
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft(), added]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.message.includes("공개 인터넷"));
});

test("연결 해제 atomic payload에는 Reservation 변경 명령이 없다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources(input([existingDraft({ markedForDeletion: true })]), fixture.deps);
  assert.equal("reservations" in (fixture.getAtomicInput() ?? {}), false);
});

test("HTTP 환경처럼 randomUUID가 없어도 안전한 신규 행 ID를 생성한다", () => {
  const clientId = createCalendarSourceClientId({
    getRandomValues: (values) => {
      values.set([1, 2, 3, 4]);
      return values;
    },
  });
  assert.equal(clientId, "01020304-0000-4000-8000-000000000000");
});

test("연결 추가는 Provider별 배열에 즉시 새 행을 추가하고 기본 이름을 순번대로 만든다", () => {
  let drafts: CalendarSourceDraft[] = [];
  const add = (provider: "AIRBNB" | "BOOKING" | "AGODA", providerLabel: string, clientId: string) => {
    drafts = [...drafts, createNewCalendarSourceDraft({ drafts, provider, providerLabel, roomName: "301호", clientId })];
  };
  add("AIRBNB", "Airbnb", "airbnb-1");
  add("AIRBNB", "Airbnb", "airbnb-2");
  add("BOOKING", "Booking.com", "booking-1");
  add("BOOKING", "Booking.com", "booking-2");
  add("AGODA", "Agoda", "agoda-1");
  add("AGODA", "Agoda", "agoda-2");

  assert.deepEqual(drafts.map((draft) => draft.name), [
    "301호 Airbnb",
    "301호 Airbnb 2",
    "301호 Booking.com",
    "301호 Booking.com 2",
    "301호 Agoda",
    "301호 Agoda 2",
  ]);
  assert.equal(new Set(drafts.map((draft) => draft.key)).size, drafts.length);
});

test("신규 행 삭제와 행별 연결 테스트 상태 변경은 다른 행에 영향을 주지 않는다", () => {
  const first = createNewCalendarSourceDraft({ drafts: [], provider: "AIRBNB", providerLabel: "Airbnb", roomName: "301호", clientId: "first" });
  const second = createNewCalendarSourceDraft({ drafts: [first], provider: "AIRBNB", providerLabel: "Airbnb", roomName: "301호", clientId: "second" });
  const updated = updateCalendarSourceDraftByKey([first, second], first.key, (draft) => ({
    ...draft,
    testState: { status: "success", testedUrl: newUrl, result: result("AIRBNB", newUrl) },
  }));

  assert.equal(updated[0].testState.status, "success");
  assert.equal(updated[1].testState.status, "idle");
  assert.deepEqual(removeNewCalendarSourceDraft(updated, first.key).map((draft) => draft.key), [second.key]);
});

test("수정 취소 시 기존 연결의 삭제 예정 상태가 원본으로 복원된다", () => {
  const source = { id: "source-1", provider: "AIRBNB" as const, name: "Airbnb", calendarUrl: oldUrl, isActive: true, lastSyncedAt: null, latestSyncStatus: null, latestSyncStartedAt: null, latestSyncCompletedAt: null, latestFetchedCount: 0, latestErrorSummary: null, isSyncing: false };
  const [initial] = createInitialCalendarSourceDrafts([source]);
  const changed = updateCalendarSourceDraftByKey([initial], initial.key, (draft) => draft.kind === "existing" ? { ...draft, isActive: false, markedForDeletion: true } : draft);
  const [restored] = createInitialCalendarSourceDrafts([source]);

  assert.equal(changed[0].kind === "existing" && changed[0].markedForDeletion, true);
  assert.equal(restored.kind === "existing" && restored.markedForDeletion, false);
  assert.equal(restored.isActive, true);
});

test("연결 추가 버튼은 폼을 제출하지 않고 모바일과 PC 레이아웃에서 새 행을 추가한다", () => {
  const editorSource = readFileSync(
    "src/features/rooms/components/room-calendar-source-editor.tsx",
    "utf8",
  );

  assert.match(editorSource, /<Button type="button"[^>]+onClick=\{\(\) => addDraft\(config\.provider, config\.label\)\}/);
  assert.match(editorSource, /grid min-w-0 gap-2 lg:grid-cols-/);
  assert.match(editorSource, /createCalendarSourceClientId\(\)/);
  assert.doesNotMatch(editorSource, /crypto\.randomUUID\(\)/);
});

test("실제 삭제된 Source만 draft에서 즉시 제거하고 다른 OTA는 유지한다", () => {
  const first = createInitialCalendarSourceDrafts([
    { id: "source-1", provider: "AIRBNB", name: "Airbnb", calendarUrl: oldUrl, isActive: true, lastSyncedAt: null, latestSyncStatus: null, latestSyncStartedAt: null, latestSyncCompletedAt: null, latestFetchedCount: 0, latestErrorSummary: null, isSyncing: false },
    { id: "source-2", provider: "BOOKING", name: "Booking", calendarUrl: bookingUrl, isActive: true, lastSyncedAt: null, latestSyncStatus: null, latestSyncStartedAt: null, latestSyncCompletedAt: null, latestFetchedCount: 0, latestErrorSummary: null, isSyncing: false },
  ]);
  assert.deepEqual(removeExistingCalendarSourceDraft(first, "source-1").map((draft) => draft.kind === "existing" ? draft.id : draft.key), ["source-2"]);
});
