import test from "node:test";
import assert from "node:assert/strict";
import type { CalendarDraftConnectionResult } from "../../calendar-sources/calendar-source.types";
import { calendarSourceDraftSubmitErrors, createInitialCalendarSourceDrafts } from "../room-calendar-source-draft";
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

test("기존 Source URL 변경은 서버 재테스트 후 저장한다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources(input([existingDraft({ calendarUrl: newUrl, testedCalendarUrl: newUrl })]), fixture.deps);
  assert.equal(fixture.getTestCount(), 1);
  assert.equal(fixture.getAtomicInput()?.sourceUpdates[0].calendarUrl, newUrl);
});

test("기존 Source URL 변경 후 미테스트 저장을 차단한다", async () => {
  const fixture = dependencies();
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft({ calendarUrl: newUrl })]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "UNTESTED");
  assert.equal(fixture.getAtomicInput(), null);
});

test("기존 Source URL 연결 테스트 실패 시 저장을 차단한다", async () => {
  const fixture = dependencies({ testConnection: async () => { throw new Error("HTTP 400"); } });
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft({ calendarUrl: newUrl, testedCalendarUrl: newUrl })]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "TEST_FAILED" && error.message === "HTTP 400");
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
  const [draft] = createInitialCalendarSourceDrafts([{ id: "source-1", provider: "AIRBNB", name: "Airbnb", calendarUrl: oldUrl, isActive: true, lastSyncedAt: null, latestSyncStatus: null, latestSyncStartedAt: null, latestSyncCompletedAt: null, latestFetchedCount: 0, latestErrorSummary: null }]);
  if (draft.kind !== "existing") throw new Error("existing draft expected");
  const changed = { ...draft, url: newUrl, testState: { status: "success" as const, testedUrl: oldUrl, result: result("AIRBNB", oldUrl) } };
  assert.deepEqual(calendarSourceDraftSubmitErrors([changed])[draft.key], ["변경한 URL의 연결 테스트를 완료해 주세요."]);
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
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft({ calendarUrl: newUrl, testedCalendarUrl: newUrl })]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.code === "PROVIDER_MISMATCH");
});

test("SSRF 차단 연결 테스트 실패를 저장 실패로 전달한다", async () => {
  const fixture = dependencies({ testConnection: async () => { throw new Error("공개 인터넷 주소만 사용할 수 있습니다."); } });
  await assert.rejects(() => updateRoomWithCalendarSources(input([existingDraft({ calendarUrl: newUrl, testedCalendarUrl: newUrl })]), fixture.deps), (error: unknown) => error instanceof UpdateRoomCalendarError && error.message.includes("공개 인터넷"));
});

test("연결 해제 atomic payload에는 Reservation 변경 명령이 없다", async () => {
  const fixture = dependencies();
  await updateRoomWithCalendarSources(input([existingDraft({ markedForDeletion: true })]), fixture.deps);
  assert.equal("reservations" in (fixture.getAtomicInput() ?? {}), false);
});
