export type SyncErrorCode = "ICS_DOWNLOAD_FAILED" | "ICS_HTTP_403" | "ICS_HTTP_404" | "ICS_TIMEOUT" | "ICS_INVALID_CONTENT" | "ICS_PARSE_FAILED" | "SOURCE_DISABLED" | "SOURCE_URL_INVALID" | "PROVIDER_CLASSIFICATION_FAILED" | "CALENDAR_FEED_QUARANTINED" | "DATABASE_WRITE_FAILED" | "UNKNOWN_ERROR";

export const SYNC_ERROR_MESSAGES: Record<SyncErrorCode, string> = {
  ICS_DOWNLOAD_FAILED: "OTA 캘린더를 다운로드하지 못했습니다. 잠시 후 다시 시도하세요.", ICS_HTTP_403: "OTA 캘린더에 접근할 수 없습니다. Calendar URL을 다시 확인하세요.", ICS_HTTP_404: "OTA 캘린더를 찾을 수 없습니다. Calendar URL을 다시 확인하세요.", ICS_TIMEOUT: "OTA 응답 시간이 초과되었습니다. 잠시 후 다시 시도하세요.", ICS_INVALID_CONTENT: "OTA 응답이 유효한 캘린더 형식이 아닙니다.", ICS_PARSE_FAILED: "캘린더 형식을 읽을 수 없습니다.", SOURCE_DISABLED: "비활성화된 CalendarSource입니다.", SOURCE_URL_INVALID: "Calendar URL이 올바르지 않습니다.", PROVIDER_CLASSIFICATION_FAILED: "OTA 이벤트를 예약으로 분류하지 못했습니다.", CALENDAR_FEED_QUARANTINED: "Booking.com 캘린더의 내용이 이전 동기화와 크게 달라 자동 반영을 중지했습니다. Booking.com에서 최신 iCal URL을 확인해 주세요.", DATABASE_WRITE_FAILED: "동기화 결과를 저장하지 못했습니다.", UNKNOWN_ERROR: "동기화 중 안전하게 처리할 수 없는 오류가 발생했습니다.",
};

export interface StandardSyncError { code: SyncErrorCode; safeMessage: string; technicalMessage: string; httpStatus: number | null; retryCount: number }
type FetchLikeError = Error & { code?: string; httpStatus?: number; attemptCount?: number; reasonCode?: string };

export function standardizeSyncError(error: unknown): StandardSyncError {
  const value = error instanceof Error ? error as FetchLikeError : null;
  const httpStatus = value?.httpStatus ?? null;
  let code: SyncErrorCode = "UNKNOWN_ERROR";
  if (httpStatus === 403) code = "ICS_HTTP_403"; else if (httpStatus === 404) code = "ICS_HTTP_404";
  else if (value?.name === "IcsDocumentParseError") code = "ICS_PARSE_FAILED"; else if (value?.code === "TIMEOUT") code = "ICS_TIMEOUT";
  else if (["INVALID_ICS", "CONTENT_TYPE", "TOO_LARGE"].includes(value?.code ?? "")) code = "ICS_INVALID_CONTENT";
  else if (["INVALID_URL", "PROTOCOL", "SSRF"].includes(value?.code ?? "")) code = "SOURCE_URL_INVALID";
  else if (value?.code === "CALENDAR_FEED_QUARANTINED") code = "CALENDAR_FEED_QUARANTINED";
  else if (value?.name === "CalendarFetchError") code = "ICS_DOWNLOAD_FAILED";
  const reason = value?.reasonCode ? `[${value.reasonCode}] ` : "";
  return { code, safeMessage: SYNC_ERROR_MESSAGES[code], technicalMessage: `${reason}${value?.message ?? String(error)}`.slice(0, 2000), httpStatus, retryCount: Math.max(0, (value?.attemptCount ?? 1) - 1) };
}

export function summarizeError(message: string, maxLength = 140) { const normalized = message.replace(/\s+/g, " ").trim(); return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`; }
