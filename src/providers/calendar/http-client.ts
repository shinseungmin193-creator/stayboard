import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ALLOWED_CALENDAR_CONTENT_TYPES, ICS_DOWNLOAD_MAX_ATTEMPTS, ICS_DOWNLOAD_TIMEOUT_MS, ICS_DOWNLOAD_TOTAL_TIMEOUT_MS, ICS_MAX_REDIRECTS, ICS_RETRY_BASE_DELAY_MS, ICS_RETRY_MAX_DELAY_MS } from "./constants";
import type { CalendarFetchResult, CalendarProviderType } from "./types";
import { exceedsContentLengthLimit, exceedsResponseByteLimit, isRetryableHttpStatus } from "./http-policy";

export type CalendarFetchErrorCode = "INVALID_URL" | "PROTOCOL" | "SSRF" | "DNS" | "TIMEOUT" | "HTTP" | "REDIRECT" | "CONTENT_TYPE" | "TOO_LARGE" | "INVALID_ICS" | "NETWORK";
export class CalendarFetchError extends Error { attemptCount = 1; constructor(public readonly code: CalendarFetchErrorCode, message: string, public readonly retryable = false, public readonly httpStatus?: number) { super(message); this.name = "CalendarFetchError"; } }

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) { const parts = address.split(".").map(Number); return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168); }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> { if (signal.aborted) return Promise.reject(new CalendarFetchError("TIMEOUT", "캘린더 서버 응답 시간이 초과되었습니다.", true)); return new Promise<T>((resolve, reject) => { const abort = () => reject(new CalendarFetchError("TIMEOUT", "캘린더 서버 응답 시간이 초과되었습니다.", true)); signal.addEventListener("abort", abort, { once: true }); operation.then((value) => { signal.removeEventListener("abort", abort); resolve(value); }, (error: unknown) => { signal.removeEventListener("abort", abort); reject(error); }); }); }

async function assertPublicHost(url: URL, signal: AbortSignal): Promise<void> {
  if (url.protocol !== "https:" || url.username || url.password) throw new CalendarFetchError("PROTOCOL", "HTTPS 캘린더 URL만 사용할 수 있습니다.");
  if (["localhost", "0.0.0.0", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) throw new CalendarFetchError("SSRF", "로컬 네트워크 주소는 사용할 수 없습니다.");
  try { const addresses = await withAbort(lookup(url.hostname, { all: true, verbatim: true }), signal); if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new CalendarFetchError("SSRF", "공개 인터넷 주소만 사용할 수 있습니다."); }
  catch (error) { if (error instanceof CalendarFetchError) throw error; throw new CalendarFetchError("DNS", "캘린더 서버 주소를 확인할 수 없습니다."); }
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

async function fetchCalendarAttempt(input: { provider: CalendarProviderType; calendarUrl: string; supportsUrl: (url: URL) => boolean; signal: AbortSignal }): Promise<CalendarFetchResult> {
  let current: URL; try { current = new URL(input.calendarUrl); } catch { throw new CalendarFetchError("INVALID_URL", "올바른 캘린더 URL이 아닙니다."); }
  for (let redirects = 0; redirects <= ICS_MAX_REDIRECTS; redirects += 1) {
    if (!input.supportsUrl(current)) throw new CalendarFetchError("INVALID_URL", "선택한 OTA와 URL 호스트가 일치하지 않습니다.");
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
export async function fetchCalendarDocument(input: { provider: CalendarProviderType; calendarUrl: string; supportsUrl: (url: URL) => boolean; signal?: AbortSignal }): Promise<CalendarFetchResult> {
  const deadline = Date.now() + ICS_DOWNLOAD_TOTAL_TIMEOUT_MS; let lastError: CalendarFetchError | null = null;
  for (let attempt = 1; attempt <= ICS_DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now(); if (remaining <= 0) throw lastError ?? new CalendarFetchError("TIMEOUT", "캘린더 다운로드 전체 제한 시간이 초과되었습니다.");
    const timeout = AbortSignal.timeout(Math.min(ICS_DOWNLOAD_TIMEOUT_MS, remaining)); const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
    try { return await fetchCalendarAttempt({ ...input, signal }); }
    catch (error) {
      if (error instanceof CalendarFetchError) error.attemptCount = attempt;
      if (!(error instanceof CalendarFetchError) || !error.retryable || attempt === ICS_DOWNLOAD_MAX_ATTEMPTS || input.signal?.aborted) throw error;
      lastError = error; const delay = Math.min(ICS_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), ICS_RETRY_MAX_DELAY_MS) + Math.floor(Math.random() * 101);
      if (Date.now() + delay >= deadline) throw error; await wait(delay, input.signal);
    }
  }
  throw lastError ?? new CalendarFetchError("NETWORK", "캘린더 서버에 연결하지 못했습니다.");
}
