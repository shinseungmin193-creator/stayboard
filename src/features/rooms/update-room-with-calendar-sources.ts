import type { CalendarProviderType } from "../../lib/generated/prisma/enums";
import type { CalendarDraftConnectionResult } from "../calendar-sources/calendar-source.types";
import {
  ROOM_CALENDAR_PROVIDER_CONFIG,
  SUPPORTED_ROOM_CALENDAR_PROVIDERS,
  type RoomCalendarProvider,
  type SupportedRoomCalendarProvider,
} from "./room-calendar-draft";

export type RoomCalendarSourceUpdateDraft =
  | {
      kind: "existing";
      clientKey: string;
      id: string;
      provider: RoomCalendarProvider;
      name: string;
      calendarUrl: string;
      isActive: boolean;
      markedForDeletion: boolean;
      testedCalendarUrl: string;
    }
  | {
      kind: "new";
      clientKey: string;
      provider: RoomCalendarProvider;
      name: string;
      calendarUrl: string;
      isActive: true;
      testedCalendarUrl: string;
    };

export interface UpdateRoomWithCalendarSourcesInput {
  id: string;
  propertyId: string;
  name: string;
  capacity: number;
  sources: RoomCalendarSourceUpdateDraft[];
}

export interface CurrentRoomForCalendarUpdate {
  id: string;
  sources: Array<{
    id: string;
    provider: CalendarProviderType;
    name: string;
    calendarUrl: string;
    isActive: boolean;
  }>;
}

export interface RoomWithCalendarSourcesAtomicInput {
  room: { id: string; propertyId: string; name: string; capacity: number };
  sourceUpdates: Array<{
    id: string;
    name: string;
    calendarUrl: string;
    isActive: boolean;
  }>;
  sourceCreates: Array<{
    provider: SupportedRoomCalendarProvider;
    name: string;
    calendarUrl: string;
    isActive: true;
  }>;
}

export type UpdateRoomCalendarErrorCode =
  | "ROOM_NOT_FOUND"
  | "PROPERTY_NOT_FOUND"
  | "SOURCE_NOT_FOUND"
  | "PROVIDER_MISMATCH"
  | "UNSUPPORTED"
  | "UNTESTED"
  | "TEST_FAILED"
  | "DUPLICATE";

export class UpdateRoomCalendarError extends Error {
  constructor(
    public readonly code: UpdateRoomCalendarErrorCode,
    message: string,
    public readonly sourceKey?: string,
  ) {
    super(message);
    this.name = "UpdateRoomCalendarError";
  }
}

type Dependencies = {
  findRoom: (id: string) => Promise<CurrentRoomForCalendarUpdate | null>;
  propertyExists: (id: string) => Promise<{ id: string } | null>;
  testConnection: (
    provider: SupportedRoomCalendarProvider,
    calendarUrl: string,
  ) => Promise<CalendarDraftConnectionResult>;
  normalizeUrl: (calendarUrl: string) => string;
  updateAtomically: (input: RoomWithCalendarSourcesAtomicInput) => Promise<{ id: string }>;
};

const providerLabel = (provider: RoomCalendarProvider) =>
  ROOM_CALENDAR_PROVIDER_CONFIG.find((item) => item.provider === provider)?.label ?? provider;

function safeNormalize(value: string, normalizeUrl: Dependencies["normalizeUrl"]) {
  try {
    return normalizeUrl(value);
  } catch {
    return value.trim();
  }
}

export async function updateRoomWithCalendarSources(
  input: UpdateRoomWithCalendarSourcesInput,
  dependencies: Dependencies,
) {
  const current = await dependencies.findRoom(input.id);
  if (!current) throw new UpdateRoomCalendarError("ROOM_NOT_FOUND", "객실을 찾을 수 없습니다.");
  if (!(await dependencies.propertyExists(input.propertyId))) {
    throw new UpdateRoomCalendarError("PROPERTY_NOT_FOUND", "선택한 숙소가 존재하지 않습니다.");
  }

  const currentById = new Map(current.sources.map((source) => [source.id, source]));
  const submittedExistingIds = new Set<string>();
  const sourceUpdates: RoomWithCalendarSourcesAtomicInput["sourceUpdates"] = [];
  const sourceCreates: RoomWithCalendarSourcesAtomicInput["sourceCreates"] = [];

  for (const draft of input.sources) {
    if (draft.kind !== "existing") continue;
    if (submittedExistingIds.has(draft.id)) {
      throw new UpdateRoomCalendarError("DUPLICATE", "같은 캘린더 연결이 중복 제출되었습니다.", draft.clientKey);
    }
    submittedExistingIds.add(draft.id);

    const existing = currentById.get(draft.id);
    if (!existing) {
      throw new UpdateRoomCalendarError("SOURCE_NOT_FOUND", "이 객실의 캘린더 연결을 찾을 수 없습니다.", draft.clientKey);
    }
    if (existing.provider !== draft.provider) {
      throw new UpdateRoomCalendarError("PROVIDER_MISMATCH", "기존 연결의 Provider는 변경할 수 없습니다.", draft.clientKey);
    }

    if (draft.markedForDeletion) {
      sourceUpdates.push({
        id: existing.id,
        name: existing.name,
        calendarUrl: existing.calendarUrl,
        isActive: false,
      });
      continue;
    }

    const calendarUrl = draft.calendarUrl.trim();
    const changedUrl = calendarUrl !== existing.calendarUrl;
    let verifiedUrl = existing.calendarUrl;
    if (changedUrl) {
      if (draft.testedCalendarUrl.trim() !== calendarUrl) {
        throw new UpdateRoomCalendarError("UNTESTED", "변경한 URL의 연결 테스트를 완료해 주세요.", draft.clientKey);
      }
      if (!SUPPORTED_ROOM_CALENDAR_PROVIDERS.includes(draft.provider as SupportedRoomCalendarProvider)) {
        throw new UpdateRoomCalendarError("UNSUPPORTED", "이 Provider는 아직 연결 테스트를 지원하지 않습니다.", draft.clientKey);
      }
      try {
        const result = await dependencies.testConnection(draft.provider as SupportedRoomCalendarProvider, calendarUrl);
        if (result.provider !== draft.provider) {
          throw new UpdateRoomCalendarError("PROVIDER_MISMATCH", "연결 테스트 결과의 Provider가 일치하지 않습니다.", draft.clientKey);
        }
        verifiedUrl = result.normalizedUrl;
      } catch (error) {
        if (error instanceof UpdateRoomCalendarError) throw error;
        throw new UpdateRoomCalendarError(
          "TEST_FAILED",
          error instanceof Error ? error.message : "연결 테스트에 실패했습니다.",
          draft.clientKey,
        );
      }
    }

    sourceUpdates.push({
      id: existing.id,
      name: draft.name.trim(),
      calendarUrl: verifiedUrl,
      isActive: draft.isActive,
    });
  }

  const providerCounts = new Map<RoomCalendarProvider, number>();
  for (const source of current.sources) {
    const provider = source.provider as RoomCalendarProvider;
    providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
  }

  for (const draft of input.sources) {
    if (draft.kind !== "new") continue;
    const calendarUrl = draft.calendarUrl.trim();
    if (!calendarUrl) continue;
    if (!SUPPORTED_ROOM_CALENDAR_PROVIDERS.includes(draft.provider as SupportedRoomCalendarProvider)) {
      throw new UpdateRoomCalendarError("UNSUPPORTED", "이 Provider는 아직 연결 테스트를 지원하지 않습니다.", draft.clientKey);
    }
    if (draft.testedCalendarUrl.trim() !== calendarUrl) {
      throw new UpdateRoomCalendarError("UNTESTED", "신규 URL의 연결 테스트를 완료해 주세요.", draft.clientKey);
    }

    let result: CalendarDraftConnectionResult;
    try {
      result = await dependencies.testConnection(draft.provider as SupportedRoomCalendarProvider, calendarUrl);
      if (result.provider !== draft.provider) {
        throw new UpdateRoomCalendarError("PROVIDER_MISMATCH", "연결 테스트 결과의 Provider가 일치하지 않습니다.", draft.clientKey);
      }
    } catch (error) {
      if (error instanceof UpdateRoomCalendarError) throw error;
      throw new UpdateRoomCalendarError(
        "TEST_FAILED",
        error instanceof Error ? error.message : "연결 테스트에 실패했습니다.",
        draft.clientKey,
      );
    }

    const count = providerCounts.get(draft.provider) ?? 0;
    const baseName = `${input.name} ${providerLabel(draft.provider)}`;
    sourceCreates.push({
      provider: draft.provider as SupportedRoomCalendarProvider,
      name: draft.name.trim() || (count ? `${baseName} ${count + 1}` : baseName),
      calendarUrl: result.normalizedUrl,
      isActive: true,
    });
    providerCounts.set(draft.provider, count + 1);
  }

  const updateById = new Map(sourceUpdates.map((source) => [source.id, source]));
  const finalUrls = [
    ...current.sources.map((source) => updateById.get(source.id)?.calendarUrl ?? source.calendarUrl),
    ...sourceCreates.map((source) => source.calendarUrl),
  ];
  const normalizedUrls = new Set<string>();
  for (const calendarUrl of finalUrls) {
    const normalizedUrl = safeNormalize(calendarUrl, dependencies.normalizeUrl);
    if (normalizedUrls.has(normalizedUrl)) {
      throw new UpdateRoomCalendarError("DUPLICATE", "같은 객실에 동일한 iCal URL을 두 번 저장할 수 없습니다.");
    }
    normalizedUrls.add(normalizedUrl);
  }

  await dependencies.updateAtomically({
    room: { id: input.id, propertyId: input.propertyId, name: input.name, capacity: input.capacity },
    sourceUpdates,
    sourceCreates,
  });

  return {
    id: input.id,
    updatedSourceCount: sourceUpdates.length,
    createdSourceCount: sourceCreates.length,
  };
}
