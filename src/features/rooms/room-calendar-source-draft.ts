import type { CalendarDraftConnectionResult } from "../calendar-sources/calendar-source.types";
import { createClientOperationId, type ClientOperationCrypto } from "../../lib/client-operation-id";
import type { RoomCalendarSourceSummary } from "./room.types";
import type { RoomCalendarProvider } from "./room-calendar-draft";
import type { RoomCalendarSourceUpdateDraft } from "./update-room-with-calendar-sources";

export type CalendarConnectionTestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; testedUrl: string; result: CalendarDraftConnectionResult }
  | { status: "failure"; testedUrl: string; code: string; message: string };

export type CalendarSourceDraft =
  | {
      kind: "existing";
      key: string;
      id: string;
      provider: RoomCalendarProvider;
      name: string;
      originalName: string;
      originalUrl: string;
      url: string;
      isActive: boolean;
      originalIsActive: boolean;
      markedForDeletion: boolean;
      testState: CalendarConnectionTestState;
      sync: Omit<RoomCalendarSourceSummary, "id" | "provider" | "name" | "calendarUrl" | "isActive">;
    }
  | {
      kind: "new";
      key: string;
      clientId: string;
      provider: RoomCalendarProvider;
      name: string;
      url: string;
      isActive: true;
      testState: CalendarConnectionTestState;
    };

export function createCalendarSourceClientId(
  cryptoApi: ClientOperationCrypto | undefined = typeof globalThis.crypto === "undefined" ? undefined : globalThis.crypto,
): string {
  return createClientOperationId("draft", cryptoApi);
}

export function createNewCalendarSourceDraft(input: {
  drafts: readonly CalendarSourceDraft[];
  provider: RoomCalendarProvider;
  providerLabel: string;
  roomName: string;
  clientId?: string;
}): Extract<CalendarSourceDraft, { kind: "new" }> {
  const clientId = input.clientId ?? createCalendarSourceClientId();
  const count = input.drafts.filter((draft) => draft.provider === input.provider).length;
  const baseName = `${input.roomName.trim() || "새 객실"} ${input.providerLabel}`;
  return {
    kind: "new",
    key: `new:${clientId}`,
    clientId,
    provider: input.provider,
    name: count ? `${baseName} ${count + 1}` : baseName,
    url: "",
    isActive: true,
    testState: { status: "idle" },
  };
}

export function updateCalendarSourceDraftByKey(
  drafts: readonly CalendarSourceDraft[],
  key: string,
  update: (draft: CalendarSourceDraft) => CalendarSourceDraft,
): CalendarSourceDraft[] {
  return drafts.map((draft) => draft.key === key ? update(draft) : draft);
}

export function removeNewCalendarSourceDraft(
  drafts: readonly CalendarSourceDraft[],
  key: string,
): CalendarSourceDraft[] {
  return drafts.filter((draft) => draft.kind !== "new" || draft.key !== key);
}

export function removeExistingCalendarSourceDraft(
  drafts: readonly CalendarSourceDraft[],
  calendarSourceId: string,
): CalendarSourceDraft[] {
  return drafts.filter((draft) => draft.kind !== "existing" || draft.id !== calendarSourceId);
}

export function createInitialCalendarSourceDrafts(sources: RoomCalendarSourceSummary[]): CalendarSourceDraft[] {
  return sources.map((source) => ({
    kind: "existing",
    key: `existing:${source.id}`,
    id: source.id,
    provider: source.provider as RoomCalendarProvider,
    name: source.name,
    originalName: source.name,
    originalUrl: source.calendarUrl,
    url: source.calendarUrl,
    isActive: source.isActive,
    originalIsActive: source.isActive,
    markedForDeletion: false,
    testState: { status: "idle" },
    sync: {
      lastSyncedAt: source.lastSyncedAt,
      latestSyncStatus: source.latestSyncStatus,
      latestSyncStartedAt: source.latestSyncStartedAt,
      latestSyncCompletedAt: source.latestSyncCompletedAt,
      latestFetchedCount: source.latestFetchedCount,
      latestErrorSummary: source.latestErrorSummary,
      isSyncing: source.isSyncing,
    },
  }));
}

export function isCalendarSourceDraftDirty(draft: CalendarSourceDraft) {
  if (draft.kind === "new") return Boolean(draft.url.trim() || draft.name.trim());
  return draft.name !== draft.originalName
    || draft.url !== draft.originalUrl
    || draft.isActive !== draft.originalIsActive
    || draft.markedForDeletion;
}

export function calendarSourceDraftSubmitErrors(drafts: CalendarSourceDraft[]) {
  const errors: Record<string, string[]> = {};
  const comparableUrls = new Map<string, string>();
  for (const draft of drafts) {
    if (draft.kind === "existing" && draft.markedForDeletion) continue;
    const url = draft.url.trim();
    if (draft.kind === "new" && !url) continue;
    if (draft.kind === "existing" && url !== draft.originalUrl) {
      errors[draft.key] = ["기존 iCal URL은 캘린더 연결 화면의 'URL 갱신' 기능으로 변경해 주세요."];
      continue;
    }
    const requiresTest = draft.kind === "new";
    if (requiresTest && (draft.testState.status !== "success" || draft.testState.testedUrl !== url)) {
      errors[draft.key] = [draft.kind === "new" ? "신규 URL의 연결 테스트를 완료해 주세요." : "변경한 URL의 연결 테스트를 완료해 주세요."];
      continue;
    }
    let comparable = url;
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      comparable = parsed.toString();
    } catch {
      // 서버의 Provider URL 검증이 구체적인 오류를 반환한다.
    }
    const duplicateKey = comparableUrls.get(comparable);
    if (duplicateKey) {
      errors[draft.key] = ["같은 iCal URL을 두 번 저장할 수 없습니다."];
      errors[duplicateKey] = ["같은 iCal URL을 두 번 저장할 수 없습니다."];
    } else {
      comparableUrls.set(comparable, draft.key);
    }
  }
  return errors;
}

export function toCalendarSourceUpdateDrafts(drafts: CalendarSourceDraft[]): RoomCalendarSourceUpdateDraft[] {
  return drafts.map((draft) => ({
    kind: draft.kind,
    clientKey: draft.key,
    ...(draft.kind === "existing" ? { id: draft.id, markedForDeletion: draft.markedForDeletion } : {}),
    provider: draft.provider,
    name: draft.name,
    calendarUrl: draft.url,
    isActive: draft.isActive,
    testedCalendarUrl: draft.testState.status === "success" && draft.testState.testedUrl === draft.url.trim()
      ? draft.testState.testedUrl
      : "",
  })) as RoomCalendarSourceUpdateDraft[];
}
