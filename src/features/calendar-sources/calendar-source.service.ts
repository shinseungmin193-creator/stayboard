import "server-only";
import type { CalendarProviderType as DbProviderType } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";
import { withAccessAuditMetadata, type AccessContext } from "@/features/access-control";
import { CalendarSyncAlreadyRunningError, withCalendarSourceAdvisoryLock } from "@/features/calendar-sync/infrastructure/calendar-sync-lock";
import { calendarProviderRegistry, CalendarFetchError, type CalendarFetchErrorCode, type CalendarProviderType } from "@/providers/calendar";
import { analyzeCalendar, CalendarParseError, type CalendarParseErrorCode } from "./calendar-source.analysis";
import type { CalendarConnectionResult, CalendarDraftConnectionResult, CalendarSourceDeleteTarget } from "./calendar-source.types";
import { isCalendarSourceDeleteConfirmationValid } from "./domain/calendar-source-deletion";
import { CalendarSourceDeletionRepositoryError, countCalendarSourceDeleteImpact, createCalendarSource, deleteCalendarSourceTransaction, findCalendarRoom, findCalendarSource, findCalendarSourceDeleteTarget, findDuplicateCalendarUrl, setCalendarSourceActive, updateCalendarSource } from "./calendar-source.repository";
export { maskCalendarUrl } from "./calendar-source-url";

type Input = { roomId: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean };
export type CalendarSourceServiceErrorCode = "ROOM_NOT_FOUND" | "DUPLICATE" | "NOT_FOUND" | "FETCH" | "UNSUPPORTED" | "PROVIDER_MISMATCH" | "SYNC_IN_PROGRESS" | "CONFIRMATION_MISMATCH" | "SCOPE_CHANGED" | CalendarFetchErrorCode | CalendarParseErrorCode;
export class CalendarSourceServiceError extends Error { constructor(public readonly code: CalendarSourceServiceErrorCode, message: string) { super(message); this.name = "CalendarSourceServiceError"; } }

export function normalizeCalendarUrl(value: string): string { const url = new URL(value.trim()); url.hash = ""; return url.toString(); }
export function validateProviderUrl(provider: CalendarProviderType, calendarUrl: string): string { let normalized: string; try { normalized = normalizeCalendarUrl(calendarUrl); } catch { throw new CalendarSourceServiceError("INVALID_URL", "올바른 HTTPS ICS URL을 입력해 주세요."); } const url = new URL(normalized); if (url.protocol !== "https:" || url.username || url.password) throw new CalendarSourceServiceError("PROTOCOL", "HTTPS 캘린더 URL만 사용할 수 있습니다."); if (!calendarProviderRegistry.has(provider)) throw new CalendarSourceServiceError("UNSUPPORTED", "이 Provider는 아직 iCal 연결 테스트를 지원하지 않습니다."); const handler = calendarProviderRegistry.get(provider); if (!handler.supportsUrl(url)) throw new CalendarSourceServiceError("PROVIDER_MISMATCH", "선택한 OTA와 URL 호스트가 일치하지 않습니다."); return normalized; }

export async function testCalendarUrlConnection(provider: CalendarProviderType, submittedUrl: string) {
  const normalizedUrl = validateProviderUrl(provider, submittedUrl);
  const handler = calendarProviderRegistry.get(provider);
  const started = performance.now();
  try { const result = await handler.fetchCalendar({ calendarUrl: normalizedUrl }); return { ...analyzeCalendar(result, Math.round(performance.now() - started)), submittedUrl, normalizedUrl }; }
  catch (error) { if (error instanceof CalendarParseError) throw new CalendarSourceServiceError(error.code, error.message); if (error instanceof CalendarFetchError) throw new CalendarSourceServiceError(error.code, error.message); throw new CalendarSourceServiceError("FETCH", "캘린더 연결 테스트 중 알 수 없는 오류가 발생했습니다."); }
}

function storedConnectionResult(result: CalendarDraftConnectionResult): CalendarConnectionResult { return { provider: result.provider, responseTimeMs: result.responseTimeMs, fetchedAt: result.fetchedAt, contentType: result.contentType, eventCount: result.eventCount, uidCount: result.uidCount, startCount: result.startCount, endCount: result.endCount, summaryCount: result.summaryCount }; }

export async function createCalendarSourceSafely(input: Input) { const calendarUrl = validateProviderUrl(input.provider, input.calendarUrl); const room = await findCalendarRoom(input.roomId); if (!room?.property) throw new CalendarSourceServiceError("ROOM_NOT_FOUND", "선택한 객실 또는 숙소가 존재하지 않습니다."); if (await findDuplicateCalendarUrl(input.roomId, calendarUrl)) throw new CalendarSourceServiceError("DUPLICATE", "같은 객실에 동일한 ICS URL이 이미 등록되어 있습니다."); return createCalendarSource({ ...input, provider: input.provider as DbProviderType, calendarUrl }); }
export async function updateCalendarSourceSafely(id: string, input: Omit<Input, "calendarUrl"> & { calendarUrl?: string }) { const existing = await findCalendarSource(id); if (!existing) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다."); const calendarUrl = input.calendarUrl ? validateProviderUrl(input.provider, input.calendarUrl) : existing.calendarUrl; if (!input.calendarUrl) validateProviderUrl(input.provider, calendarUrl); const room = await findCalendarRoom(input.roomId); if (!room?.property) throw new CalendarSourceServiceError("ROOM_NOT_FOUND", "선택한 객실 또는 숙소가 존재하지 않습니다."); if (await findDuplicateCalendarUrl(input.roomId, calendarUrl, id)) throw new CalendarSourceServiceError("DUPLICATE", "같은 객실에 동일한 ICS URL이 이미 등록되어 있습니다."); return updateCalendarSource(id, { ...input, provider: input.provider as DbProviderType, calendarUrl }); }
export async function changeCalendarSourceActive(id: string, isActive: boolean) { const existing = await findCalendarSource(id); if (!existing) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다."); if (existing.isActive === isActive) return existing; return setCalendarSourceActive(id, isActive); }
export async function testCalendarSourceConnection(id: string) { const source = await findCalendarSource(id); if (!source) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다."); return storedConnectionResult(await testCalendarUrlConnection(source.provider as CalendarProviderType, source.calendarUrl)); }

export async function getCalendarSourceDeleteTarget(id: string) {
  const target = await findCalendarSourceDeleteTarget(id);
  if (!target) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
  return target;
}

export async function getCalendarSourceDeleteImpact(id: string) {
  return countCalendarSourceDeleteImpact(id);
}

export async function deleteCalendarSourceSafely(input: {
  target: CalendarSourceDeleteTarget;
  confirmationText: string;
  context: AccessContext;
  now?: Date;
}) {
  if (!isCalendarSourceDeleteConfirmationValid(input.confirmationText)) {
    throw new CalendarSourceServiceError("CONFIRMATION_MISMATCH", "삭제 확인 문구가 일치하지 않습니다.");
  }
  try {
    return await withCalendarSourceAdvisoryLock(input.target.id, input.target.roomId, () =>
      deleteCalendarSourceTransaction({
        target: input.target,
        actorUserId: input.context.userId,
        confirmationText: input.confirmationText,
        auditMetadata: withAccessAuditMetadata(input.context, {}) as Prisma.InputJsonObject,
        now: input.now ?? new Date(),
      }),
    );
  } catch (error) {
    if (error instanceof CalendarSyncAlreadyRunningError) {
      throw new CalendarSourceServiceError("SYNC_IN_PROGRESS", "현재 동기화 중인 캘린더입니다.");
    }
    if (error instanceof CalendarSourceDeletionRepositoryError) {
      if (error.code === "NOT_FOUND") throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
      if (error.code === "SYNC_IN_PROGRESS") throw new CalendarSourceServiceError("SYNC_IN_PROGRESS", "현재 동기화 중인 캘린더입니다.");
      if (error.code === "CONFIRMATION_MISMATCH") throw new CalendarSourceServiceError("CONFIRMATION_MISMATCH", "삭제 확인 문구가 일치하지 않습니다.");
      throw new CalendarSourceServiceError("SCOPE_CHANGED", "캘린더 연결 범위가 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
    }
    throw error;
  }
}
