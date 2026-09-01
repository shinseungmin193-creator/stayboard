import "server-only";
import { assertSafePublicHttpsUrl, NetworkSafetyError } from "@/lib/network-safety";
import { ALLOWED_CALENDAR_CONTENT_TYPES, ICS_DOWNLOAD_MAX_ATTEMPTS, ICS_DOWNLOAD_TIMEOUT_MS, ICS_DOWNLOAD_TOTAL_TIMEOUT_MS, ICS_MAX_REDIRECTS, ICS_RETRY_BASE_DELAY_MS, ICS_RETRY_MAX_DELAY_MS } from "./constants";
import type { CalendarFetchResult, CalendarProviderType, CalendarUrlValidationResult } from "./types";
import { exceedsContentLengthLimit, exceedsResponseByteLimit, isRetryableHttpStatus } from "./http-policy";

export type CalendarFetchErrorCode = "INVALID_URL" | "PROTOCOL" | "SSRF" | "DNS" | "TIMEOUT" | "HTTP" | "REDIRECT" | "CONTENT_TYPE" | "TOO_LARGE" | "INVALID_ICS" | "NETWORK";
export class CalendarFetchError extends Error { attemptCount = 1; constructor(public readonly code: CalendarFetchErrorCode, message: string, public readonly retryable = false, public readonly httpStatus?: number, public readonly reasonCode?: string) { super(message); this.name = "CalendarFetchError"; } }

function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> { if (signal.aborted) return Promise.reject(new CalendarFetchError("TIMEOUT", "캘린더 서버 응답 시간이 초과되었습니다.", true)); return new Promise<T>((resolve, reject) => { const abort = () => reject(new CalendarFetchError("TIMEOUT", "캘린더 서버 응답 시간이 초과되었습니다.", true)); signal.addEventListener("abort", abort, { once: true }); operation.then((value) => { signal.removeEventListener("abort", abort); resolve(value); }, (error: unknown) => { signal.removeEventListener("abort", abort); reject(error); }); }); }

async function assertPublicHost(url: URL, signal: AbortSignal): Promise<void> {
  try { await assertSafePublicHttpsUrl(url, signal); }
  catch (error) {
    if (!(error instanceof NetworkSafetyError)) throw error;
    if (error.code === "TIMEOUT") throw new CalendarFetchError("TIMEOUT", "캘린더 서버 응답 시간이 초과되었습니다.", true);
    if (error.code === "PROTOCOL") throw new CalendarFetchError("PROTOCOL", "HTTPS 캘린더 URL만 사용할 수 있습니다.", false, undefined, "INVALID_PROTOCOL");
    if (error.code === "PRIVATE_ADDRESS") throw new CalendarFetchError("SSRF", "공개 인터넷 주소만 사용할 수 있습니다.", false, undefined, "DNS_PRIVATE_IP");
    throw new CalendarFetchError("DNS", "캘린더 서버 주소를 확인할 수 없습니다.", false, undefined, "DNS_LOOKUP_FAILED");
  }
}

async function discardResponseBody(response: Response): Promise<void> { if (response.body) await response.body.cancel(); }

async function readLimitedBody(response: Response): Promise<string> {
  if (exceedsContentLengthLimit(response.headers.get("content-length"))) throw new CalendarFetchError("TOO_LARGE", "캘린더 응답이 허용 크기를 초과했습니다.");
  if (!response.body) throw new CalendarFetchError("INVALID_ICS", "캘린더 응답 본문이 없습니다.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (exceedsResponseByteLimit(total)) { await reader.cancel(); throw new CalendarFetchError("TOO_LARGE", "캘린더 응답이 허용 크기를 초과했습니다."); } chunks.push(value); }
  const merged = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function fetchCalendarAttempt(input: { provider: CalendarProviderType; calendarUrl: string; validateSourceUrl: (url: URL) => CalendarUrlValidationResult; signal: AbortSignal }): Promise<CalendarFetchResult> {
  let current: URL; try { current = new URL(input.calendarUrl); } catch { throw new CalendarFetchError("INVALID_URL", "올바른 캘린더 URL이 아닙니다.", false, undefined, "MALFORMED_URL"); }
  for (let redirects = 0; redirects <= ICS_MAX_REDIRECTS; redirects += 1) {
    const validation = input.validateSourceUrl(current);
    if (!validation.valid) throw new CalendarFetchError("INVALID_URL", "선택한 OTA와 URL이 일치하지 않습니다.", false, undefined, redirects > 0 ? `UNSAFE_REDIRECT:${validation.reason}` : validation.reason);
    await assertPublicHost(current, input.signal);
    let response: Response;
    try { response = await fetch(current, { method: "GET", redirect: "manual", signal: input.signal, headers: { Accept: "text/calendar,text/plain;q=0.9,application/octet-stream;q=0.8", "User-Agent": "StayBoard-Calendar/1.0" } }); }
    catch { if (input.signal.aborted) throw new CalendarFetchError("TIMEOUT", "캘린더 서버 응답 시간이 초과되었습니다.", true); throw new CalendarFetchError("NETWORK", "캘린더 서버에 연결하지 못했습니다.", true); }
    if ([301, 302, 303, 307, 308].includes(response.status)) { const location = response.headers.get("location"); await discardResponseBody(response); if (!location || redirects === ICS_MAX_REDIRECTS) throw new CalendarFetchError("REDIRECT", "캘린더 서버의 리디렉션을 안전하게 처리할 수 없습니다."); current = new URL(location, current); continue; }
    if (!response.ok) { await discardResponseBody(response); throw new CalendarFetchError("HTTP", `캘린더 서버가 HTTP ${response.status} 오류를 반환했습니다.`, isRetryableHttpStatus(response.status), response.status); }
    const content = await readLimitedBody(response); const normalized = content.replace(/^\uFEFF/, "").trim();
    const contentType = response.headers.get("content-type"); const mediaType = contentType?.split(";", 1)[0].trim().toLowerCase() ?? null;
    const hasSignature = normalized.includes("BEGIN:VCALENDAR") && normalized.includes("END:VCALENDAR");
    if (!hasSignature) { if (mediaType?.includes("html")) throw new CalendarFetchError("CONTENT_TYPE", "캘린더 대신 HTML 페이지가 반환되었습니다."); throw new CalendarFetchError("INVALID_ICS", "응답이 완전한 ICS 캘린더 형식이 아닙니다."); }
    if (mediaType && !ALLOWED_CALENDAR_CONTENT_TYPES.includes(mediaType as (typeof ALLOWED_CALENDAR_CONTENT_TYPES)[number]) && !hasSignature) throw new CalendarFetchError("CONTENT_TYPE", "지원하지 않는 캘린더 응답 형식입니다.");
    return { provider: input.provider, fetchedAt: new Date(), content: normalized, contentType, etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") };
  }
  throw new CalendarFetchError("REDIRECT", "리디렉션 횟수가 제한을 초과했습니다.");
}

const wait = (milliseconds: number, signal?: AbortSignal) => signal ? withAbort(new Promise<void>((resolve) => setTimeout(resolve, milliseconds)), signal) : new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
export async function fetchCalendarDocument(input: { provider: CalendarProviderType; calendarUrl: string; validateSourceUrl: (url: URL) => CalendarUrlValidationResult; signal?: AbortSignal }): Promise<CalendarFetchResult> {
  const deadline = Date.now() + ICS_DOWNLOAD_TOTAL_TIMEOUT_MS; let lastError: CalendarFetchError | null = null;
  for (let attempt = 1; attempt <= ICS_DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now(); if (remaining <= 0) throw lastError ?? new CalendarFetchError("TIMEOUT", "캘린더 다운로드 전체 제한 시간이 초과되었습니다.");
    const timeout = AbortSignal.timeout(Math.min(ICS_DOWNLOAD_TIMEOUT_MS, remaining)); const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
    try { return await fetchCalendarAttempt({ ...input, signal }); }
    catch (error) {
      if (error instanceof CalendarFetchError) error.attemptCount = attempt;
      if (process.env.NODE_ENV === "development" && error instanceof CalendarFetchError && error.reasonCode) {
        console.warn("[calendar-url-validation]", { provider: input.provider, reasonCode: error.reasonCode });
      }
      if (!(error instanceof CalendarFetchError) || !error.retryable || attempt === ICS_DOWNLOAD_MAX_ATTEMPTS || input.signal?.aborted) throw error;
      lastError = error; const delay = Math.min(ICS_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), ICS_RETRY_MAX_DELAY_MS) + Math.floor(Math.random() * 101);
      if (Date.now() + delay >= deadline) throw error; await wait(delay, input.signal);
    }
  }
  throw lastError ?? new CalendarFetchError("NETWORK", "캘린더 서버에 연결하지 못했습니다.");
}
