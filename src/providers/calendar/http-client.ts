import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ALLOWED_CALENDAR_CONTENT_TYPES, CALENDAR_FETCH_TIMEOUT_MS, CALENDAR_MAX_REDIRECTS, CALENDAR_MAX_RESPONSE_BYTES } from "./constants";
import type { CalendarFetchResult, CalendarProviderType } from "./types";

export class CalendarFetchError extends Error { constructor(public readonly code: "INVALID_URL" | "DNS" | "TIMEOUT" | "HTTP" | "REDIRECT" | "CONTENT_TYPE" | "TOO_LARGE" | "INVALID_ICS" | "NETWORK", message: string) { super(message); this.name = "CalendarFetchError"; } }

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) { const parts = address.split(".").map(Number); return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168); }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:" || url.username || url.password) throw new CalendarFetchError("INVALID_URL", "HTTPS 캘린더 URL만 사용할 수 있습니다.");
  if (["localhost", "0.0.0.0", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) throw new CalendarFetchError("INVALID_URL", "로컬 네트워크 주소는 사용할 수 없습니다.");
  try { const addresses = await lookup(url.hostname, { all: true, verbatim: true }); if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new CalendarFetchError("INVALID_URL", "공개 인터넷 주소만 사용할 수 있습니다."); }
  catch (error) { if (error instanceof CalendarFetchError) throw error; throw new CalendarFetchError("DNS", "캘린더 서버 주소를 확인할 수 없습니다."); }
}

async function readLimitedBody(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > CALENDAR_MAX_RESPONSE_BYTES) throw new CalendarFetchError("TOO_LARGE", "캘린더 응답이 허용 크기를 초과했습니다.");
  if (!response.body) throw new CalendarFetchError("INVALID_ICS", "캘린더 응답 본문이 없습니다.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > CALENDAR_MAX_RESPONSE_BYTES) { await reader.cancel(); throw new CalendarFetchError("TOO_LARGE", "캘린더 응답이 허용 크기를 초과했습니다."); } chunks.push(value); }
  const merged = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function fetchCalendarDocument(input: { provider: CalendarProviderType; calendarUrl: string; supportsUrl: (url: URL) => boolean; signal?: AbortSignal }): Promise<CalendarFetchResult> {
  let current: URL; try { current = new URL(input.calendarUrl); } catch { throw new CalendarFetchError("INVALID_URL", "올바른 캘린더 URL이 아닙니다."); }
  const timeout = AbortSignal.timeout(CALENDAR_FETCH_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  for (let redirects = 0; redirects <= CALENDAR_MAX_REDIRECTS; redirects += 1) {
    if (!input.supportsUrl(current)) throw new CalendarFetchError("INVALID_URL", "선택한 OTA와 URL 호스트가 일치하지 않습니다.");
    await assertPublicHost(current);
    let response: Response;
    try { response = await fetch(current, { method: "GET", redirect: "manual", signal, headers: { Accept: "text/calendar,text/plain;q=0.9,application/octet-stream;q=0.8", "User-Agent": "StayBoard-Calendar/1.0" } }); }
    catch { if (signal.aborted) throw new CalendarFetchError("TIMEOUT", "캘린더 서버 응답 시간이 초과되었습니다."); throw new CalendarFetchError("NETWORK", "캘린더 서버에 연결하지 못했습니다."); }
    if ([301, 302, 303, 307, 308].includes(response.status)) { const location = response.headers.get("location"); if (!location || redirects === CALENDAR_MAX_REDIRECTS) throw new CalendarFetchError("REDIRECT", "캘린더 서버의 리디렉션을 안전하게 처리할 수 없습니다."); current = new URL(location, current); continue; }
    if (!response.ok) throw new CalendarFetchError("HTTP", `캘린더 서버가 HTTP ${response.status} 오류를 반환했습니다.`);
    const content = await readLimitedBody(response); const normalized = content.replace(/^\uFEFF/, "").trim();
    const contentType = response.headers.get("content-type"); const mediaType = contentType?.split(";", 1)[0].trim().toLowerCase() ?? null;
    const hasSignature = normalized.includes("BEGIN:VCALENDAR") && normalized.includes("END:VCALENDAR");
    if (!hasSignature) { if (mediaType?.includes("html")) throw new CalendarFetchError("CONTENT_TYPE", "캘린더 대신 HTML 페이지가 반환되었습니다."); throw new CalendarFetchError("INVALID_ICS", "응답이 완전한 ICS 캘린더 형식이 아닙니다."); }
    if (mediaType && !ALLOWED_CALENDAR_CONTENT_TYPES.includes(mediaType as (typeof ALLOWED_CALENDAR_CONTENT_TYPES)[number]) && !hasSignature) throw new CalendarFetchError("CONTENT_TYPE", "지원하지 않는 캘린더 응답 형식입니다.");
    return { provider: input.provider, fetchedAt: new Date(), content: normalized, contentType, etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") };
  }
  throw new CalendarFetchError("REDIRECT", "리디렉션 횟수가 제한을 초과했습니다.");
}
