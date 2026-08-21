import "server-only";
import type { CalendarProviderType as DbProviderType } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";
import { canAccessCompany, canAccessRoom, PermissionDeniedError, withAccessAuditMetadata, type AccessContext } from "@/features/access-control";
import { CalendarSyncAlreadyRunningError, withCalendarSourceAdvisoryLock } from "@/features/calendar-sync/infrastructure/calendar-sync-lock";
import { readCalendarFeedFingerprint } from "@/features/calendar-sync/domain/calendar-feed-fingerprint";
import { validateCalendarFeedTransition } from "@/features/calendar-sync/domain/calendar-feed-safety";
import { findCalendarFeedSafetyContext } from "@/features/calendar-sync/infrastructure/calendar-feed-safety.repository";
import { calendarProviderRegistry, CalendarFetchError, type CalendarFetchErrorCode, type CalendarProviderType } from "@/providers/calendar";
import { analyzeCalendarFeed, CalendarParseError, type CalendarParseErrorCode } from "./calendar-source.analysis";
import type { CalendarConnectionResult, CalendarDraftConnectionResult, CalendarSourceDeleteTarget } from "./calendar-source.types";
import { validateCalendarFeedConnection } from "./domain/calendar-feed-connection-validation";
import { isCalendarSourceDeleteConfirmationValid } from "./domain/calendar-source-deletion";
import { CalendarSourceUrlReplacementPreparationError, prepareCalendarSourceUrlReplacement } from "./domain/calendar-source-url-replacement";
import { CalendarSourceDeletionRepositoryError, CalendarSourceUrlReplacementRepositoryError, countCalendarSourceDeleteImpact, createCalendarSource, deleteCalendarSourceTransaction, findCalendarRoom, findCalendarSource, findCalendarSourceDeleteTarget, findDuplicateCalendarUrl, replaceCalendarSourceUrlTransaction, setCalendarSourceActive, updateCalendarSource } from "./calendar-source.repository";
export { maskCalendarUrl } from "./calendar-source-url";

type Input = { roomId: string; provider: CalendarProviderType; name: string; calendarUrl: string; isActive: boolean };
export type CalendarSourceServiceErrorCode = "ROOM_NOT_FOUND" | "DUPLICATE" | "NOT_FOUND" | "FETCH" | "UNSUPPORTED" | "PROVIDER_MISMATCH" | "SYNC_IN_PROGRESS" | "CONFIRMATION_MISMATCH" | "SCOPE_CHANGED" | "FEED_QUARANTINED" | "URL_CHANGE_REQUIRES_REFRESH" | CalendarFetchErrorCode | CalendarParseErrorCode;
export class CalendarSourceServiceError extends Error { constructor(public readonly code: CalendarSourceServiceErrorCode, message: string) { super(message); this.name = "CalendarSourceServiceError"; } }

export function normalizeCalendarUrl(value: string): string { const url = new URL(value.trim()); url.hash = ""; return url.toString(); }
export function validateProviderUrl(provider: CalendarProviderType, calendarUrl: string): string { let normalized: string; try { normalized = normalizeCalendarUrl(calendarUrl); } catch { throw new CalendarSourceServiceError("INVALID_URL", "올바른 HTTPS ICS URL을 입력해 주세요."); } const url = new URL(normalized); if (url.protocol !== "https:" || url.username || url.password) throw new CalendarSourceServiceError("PROTOCOL", "HTTPS 캘린더 URL만 사용할 수 있습니다."); if (!calendarProviderRegistry.has(provider)) throw new CalendarSourceServiceError("UNSUPPORTED", "이 Provider는 아직 iCal 연결 테스트를 지원하지 않습니다."); const handler = calendarProviderRegistry.get(provider); if (!handler.supportsUrl(url)) throw new CalendarSourceServiceError("PROVIDER_MISMATCH", "선택한 OTA와 URL 호스트가 일치하지 않습니다."); return normalized; }

type FeedSafetyContext = NonNullable<Awaited<ReturnType<typeof findCalendarFeedSafetyContext>>>;

async function inspectCalendarFeed(provider: CalendarProviderType, submittedUrl: string, options?: {
  safetyContext?: FeedSafetyContext;
  baselineReset?: boolean;
  syncSafetyPolicy?: "ENFORCE" | "REPORT";
}) {
  const normalizedUrl = validateProviderUrl(provider, submittedUrl);
  const handler = calendarProviderRegistry.get(provider);
  const started = performance.now();
  try {
    const result = await handler.fetchCalendar({ calendarUrl: normalizedUrl });
    const analysis = analyzeCalendarFeed(result, Math.round(performance.now() - started), new URL(normalizedUrl).hostname);
    const connectionValidation = validateCalendarFeedConnection({
      provider,
      fetchedEventCount: analysis.parsed.totalEventCount,
      counts: analysis.classified,
      fingerprint: analysis.fingerprint,
    });
    if (!connectionValidation.valid) {
      if (connectionValidation.reason === "PROVIDER_IDENTITY_MISMATCH") {
        throw new CalendarSourceServiceError("PROVIDER_MISMATCH", "새 캘린더 내용이 선택한 OTA Provider와 일치하지 않습니다.");
      }
      throw new CalendarSourceServiceError("CLASSIFICATION", "새 캘린더 이벤트를 선택한 OTA 예약으로 분류할 수 없습니다.");
    }
    const context = options?.safetyContext;
    const previous = context?.syncLogs[0] ?? null;
    const safety = validateCalendarFeedTransition({
      provider,
      sourceId: context?.id ?? "calendar-source-draft",
      now: new Date(),
      fetchedEventCount: analysis.parsed.totalEventCount,
      counts: analysis.classified,
      fingerprint: analysis.fingerprint,
      baselineFingerprint: readCalendarFeedFingerprint(context?.feedFingerprint),
      previousSuccessfulCounts: previous ? { fetchedCount: previous.fetchedCount, reservationCount: previous.reservationEventCount, unknownCount: previous.unknownEventCount } : null,
      sourceReservations: context?.reservations ?? [],
      roomReservations: context?.room.reservations ?? [],
      incomingReservations: analysis.classified.reservations,
      baselineReset: options?.baselineReset,
    });
    if (safety.status === "QUARANTINED" && options?.syncSafetyPolicy !== "REPORT") {
      throw new CalendarSourceServiceError("FEED_QUARANTINED", "캘린더 내용이 안전 기준을 충족하지 않아 연결을 저장하지 않았습니다. Booking.com에서 최신 iCal URL을 다시 확인해 주세요.");
    }
    return { ...analysis, safety, submittedUrl, normalizedUrl };
  } catch (error) {
    if (error instanceof CalendarSourceServiceError) throw error;
    if (error instanceof CalendarParseError) throw new CalendarSourceServiceError(error.code, error.message);
    if (error instanceof CalendarFetchError) throw new CalendarSourceServiceError(error.code, error.message);
    throw new CalendarSourceServiceError("FETCH", "캘린더 연결을 확인하는 중 예기치 않은 오류가 발생했습니다.");
  }
}

export async function testCalendarUrlConnection(provider: CalendarProviderType, submittedUrl: string) {
  const inspected = await inspectCalendarFeed(provider, submittedUrl, { baselineReset: true });
  return { ...inspected.connection, submittedUrl: inspected.submittedUrl, normalizedUrl: inspected.normalizedUrl };
}

function storedConnectionResult(result: CalendarDraftConnectionResult): CalendarConnectionResult { return { provider: result.provider, responseTimeMs: result.responseTimeMs, fetchedAt: result.fetchedAt, contentType: result.contentType, eventCount: result.eventCount, uidCount: result.uidCount, startCount: result.startCount, endCount: result.endCount, summaryCount: result.summaryCount, reservationCount: result.reservationCount, blockedCount: result.blockedCount, cancelledCount: result.cancelledCount, unknownCount: result.unknownCount }; }

export async function createCalendarSourceSafely(input: Input) {
  const calendarUrl = validateProviderUrl(input.provider, input.calendarUrl);
  const room = await findCalendarRoom(input.roomId);
  if (!room?.property) throw new CalendarSourceServiceError("ROOM_NOT_FOUND", "선택한 객실 또는 숙소가 존재하지 않습니다.");
  if (await findDuplicateCalendarUrl(input.roomId, calendarUrl)) throw new CalendarSourceServiceError("DUPLICATE", "같은 객실에 동일한 ICS URL이 이미 등록되어 있습니다.");
  const inspected = await inspectCalendarFeed(input.provider, calendarUrl, { baselineReset: true });
  return createCalendarSource({ ...input, provider: input.provider as DbProviderType, calendarUrl: inspected.normalizedUrl, feedFingerprint: inspected.fingerprint, feedFingerprintUpdatedAt: new Date(inspected.connection.fetchedAt) });
}
export async function updateCalendarSourceSafely(id: string, input: Omit<Input, "calendarUrl">) {
  const existing = await findCalendarSource(id);
  if (!existing) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
  if (existing.provider !== input.provider) throw new CalendarSourceServiceError("PROVIDER_MISMATCH", "기존 CalendarSource의 Provider는 변경할 수 없습니다. 다른 OTA 연결은 새로 등록해 주세요.");
  const calendarUrl = validateProviderUrl(input.provider, existing.calendarUrl);
  const room = await findCalendarRoom(input.roomId);
  if (!room?.property) throw new CalendarSourceServiceError("ROOM_NOT_FOUND", "선택한 객실 또는 숙소가 존재하지 않습니다.");
  if (await findDuplicateCalendarUrl(input.roomId, calendarUrl, id)) throw new CalendarSourceServiceError("DUPLICATE", "같은 객실에 동일한 ICS URL이 이미 등록되어 있습니다.");
  return updateCalendarSource(id, { ...input, provider: input.provider as DbProviderType, calendarUrl });
}
export async function changeCalendarSourceActive(id: string, isActive: boolean) { const existing = await findCalendarSource(id); if (!existing) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다."); if (existing.isActive === isActive) return existing; return setCalendarSourceActive(id, isActive); }
export async function testCalendarSourceConnection(id: string) {
  const source = await findCalendarSource(id);
  if (!source) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
  const safetyContext = await findCalendarFeedSafetyContext(id);
  if (!safetyContext) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
  const inspected = await inspectCalendarFeed(source.provider as CalendarProviderType, source.calendarUrl, { safetyContext });
  return storedConnectionResult({ ...inspected.connection, submittedUrl: source.calendarUrl, normalizedUrl: inspected.normalizedUrl });
}

export async function replaceCalendarSourceUrlSafely(input: {
  calendarSourceId: string;
  calendarUrl: string;
  context: AccessContext;
}) {
  const lockTarget = await findCalendarSource(input.calendarSourceId);
  if (!lockTarget) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
  try {
    return await withCalendarSourceAdvisoryLock(lockTarget.id, lockTarget.roomId, async () => {
      const prepared = await prepareCalendarSourceUrlReplacement(
        { calendarSourceId: lockTarget.id, expectedRoomId: lockTarget.roomId, submittedUrl: input.calendarUrl },
        {
          findSource: async (id) => {
            const source = await findCalendarSource(id);
            if (!source) return null;
            if (!canAccessCompany(input.context, source.room.property.companyId) || !canAccessRoom(input.context, { id: source.roomId, propertyId: source.room.propertyId })) throw new PermissionDeniedError();
            return { id: source.id, roomId: source.roomId, companyId: source.room.property.companyId, provider: source.provider as CalendarProviderType, calendarUrl: source.calendarUrl };
          },
          validateUrl: validateProviderUrl,
          hasDuplicate: async (roomId, calendarUrl, excludeId) => Boolean(await findDuplicateCalendarUrl(roomId, calendarUrl, excludeId)),
          inspect: async (provider, calendarUrl, sourceId) => {
            const safetyContext = await findCalendarFeedSafetyContext(sourceId);
            if (!safetyContext) throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
            const inspected = await inspectCalendarFeed(provider, calendarUrl, { safetyContext, baselineReset: true, syncSafetyPolicy: "REPORT" });
            return { normalizedUrl: inspected.normalizedUrl, fingerprint: inspected.fingerprint, syncSafetyStatus: inspected.safety.status, safetyDiagnostics: inspected.safety.diagnostics, fetchedAt: new Date(inspected.connection.fetchedAt) };
          },
        },
      );
      const updated = await replaceCalendarSourceUrlTransaction({
        calendarSourceId: prepared.calendarSourceId,
        expectedRoomId: prepared.roomId,
        expectedProvider: prepared.provider as DbProviderType,
        expectedCompanyId: prepared.companyId,
        calendarUrl: prepared.calendarUrl,
        fingerprint: prepared.fingerprint,
        safetyDiagnostics: prepared.safetyDiagnostics,
        actorUserId: input.context.userId,
        auditMetadata: withAccessAuditMetadata(input.context, {}) as Prisma.InputJsonObject,
        now: prepared.baselineAt,
      });
      return {
        ...updated,
        syncSafetyStatus: prepared.syncSafetyStatus,
        safetyReasonCodes: prepared.safetyDiagnostics.reasonCodes,
      };
    });
  } catch (error) {
    if (error instanceof CalendarSyncAlreadyRunningError) throw new CalendarSourceServiceError("SYNC_IN_PROGRESS", "현재 동기화 중인 캘린더입니다. 완료 후 다시 시도해 주세요.");
    if (error instanceof CalendarSourceUrlReplacementPreparationError) {
      if (error.code === "NOT_FOUND") throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
      if (error.code === "DUPLICATE") throw new CalendarSourceServiceError("DUPLICATE", "같은 객실에 동일한 ICS URL이 이미 등록되어 있습니다.");
      if (error.code === "UNCHANGED") throw new CalendarSourceServiceError("URL_CHANGE_REQUIRES_REFRESH", "현재 URL과 다른 최신 iCal URL을 입력해 주세요.");
      throw new CalendarSourceServiceError("SCOPE_CHANGED", "캘린더 연결 범위가 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
    }
    if (error instanceof CalendarSourceUrlReplacementRepositoryError) {
      if (error.code === "NOT_FOUND") throw new CalendarSourceServiceError("NOT_FOUND", "캘린더 연결을 찾을 수 없습니다.");
      if (error.code === "DUPLICATE") throw new CalendarSourceServiceError("DUPLICATE", "같은 객실에 동일한 ICS URL이 이미 등록되어 있습니다.");
      throw new CalendarSourceServiceError("SCOPE_CHANGED", "캘린더 연결 범위가 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
    }
    throw error;
  }
}

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
