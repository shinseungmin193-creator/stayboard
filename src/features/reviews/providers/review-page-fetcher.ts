import "server-only";

import { assertSafePublicHttpsUrl, NetworkSafetyError } from "@/lib/network-safety";
import { isAllowedListingHostname, validateListingUrl, type ReviewProviderType } from "../domain/listing-provider";
import { parseStructuredReviewData } from "../domain/structured-review-data";
import type { ReviewCollectionResult } from "../domain/review-data";

const REVIEW_FETCH_TIMEOUT_MS = 15_000;
const REVIEW_FETCH_MAX_REDIRECTS = 3;
const REVIEW_PAGE_MAX_BYTES = 2 * 1024 * 1024;

export type ReviewFetchErrorCode = "INVALID_URL" | "SSRF" | "DNS" | "TIMEOUT" | "NETWORK" | "HTTP" | "REDIRECT" | "CONTENT_TYPE" | "TOO_LARGE" | "STRUCTURED_DATA_UNAVAILABLE";

export class ReviewFetchError extends Error {
  constructor(public readonly code: ReviewFetchErrorCode, message: string, public readonly httpStatus?: number) {
    super(message);
    this.name = "ReviewFetchError";
  }
}

async function discard(response: Response) {
  if (response.body) await response.body.cancel();
}

async function readLimitedText(response: Response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > REVIEW_PAGE_MAX_BYTES) throw new ReviewFetchError("TOO_LARGE", "리뷰 페이지 응답이 허용 크기를 초과했습니다.");
  if (!response.body) throw new ReviewFetchError("CONTENT_TYPE", "리뷰 페이지 응답 본문이 없습니다.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > REVIEW_PAGE_MAX_BYTES) {
      await reader.cancel();
      throw new ReviewFetchError("TOO_LARGE", "리뷰 페이지 응답이 허용 크기를 초과했습니다.");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

function mapNetworkSafetyError(error: NetworkSafetyError): ReviewFetchError {
  if (error.code === "TIMEOUT") return new ReviewFetchError("TIMEOUT", "리뷰 페이지 응답 시간이 초과되었습니다.");
  if (error.code === "DNS") return new ReviewFetchError("DNS", "리뷰 페이지 서버 주소를 확인할 수 없습니다.");
  return new ReviewFetchError("SSRF", "허용되지 않은 네트워크 주소로 요청할 수 없습니다.");
}

export async function fetchStructuredReviewPage(input: {
  provider: ReviewProviderType;
  listingUrl: string;
  signal?: AbortSignal;
}): Promise<ReviewCollectionResult> {
  const timeout = AbortSignal.timeout(REVIEW_FETCH_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  let current: URL;
  try { current = validateListingUrl(input.provider, input.listingUrl); }
  catch { throw new ReviewFetchError("INVALID_URL", "등록된 숙소 링크가 해당 플랫폼과 일치하지 않습니다."); }

  for (let redirects = 0; redirects <= REVIEW_FETCH_MAX_REDIRECTS; redirects += 1) {
    if (!isAllowedListingHostname(input.provider, current.hostname)) {
      throw new ReviewFetchError("REDIRECT", "허용되지 않은 도메인으로 이동하는 리디렉션을 차단했습니다.");
    }
    try { await assertSafePublicHttpsUrl(current, signal); }
    catch (error) { if (error instanceof NetworkSafetyError) throw mapNetworkSafetyError(error); throw error; }

    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9",
          "Accept-Language": "en-US,en;q=0.8",
          "User-Agent": "StayBoard-ReviewCollector/1.0 (+manual structured-data refresh)",
        },
      });
    } catch {
      if (signal.aborted) throw new ReviewFetchError("TIMEOUT", "리뷰 페이지 응답 시간이 초과되었습니다.");
      throw new ReviewFetchError("NETWORK", "리뷰 페이지에 연결하지 못했습니다.");
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await discard(response);
      if (!location || redirects === REVIEW_FETCH_MAX_REDIRECTS) throw new ReviewFetchError("REDIRECT", "리디렉션을 안전하게 처리할 수 없습니다.");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      await discard(response);
      throw new ReviewFetchError("HTTP", `플랫폼이 HTTP ${response.status} 응답을 반환했습니다.`, response.status);
    }
    const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (mediaType && mediaType !== "text/html" && mediaType !== "application/xhtml+xml") {
      await discard(response);
      throw new ReviewFetchError("CONTENT_TYPE", "플랫폼이 HTML 숙소 페이지를 반환하지 않았습니다.");
    }
    const result = parseStructuredReviewData(await readLimitedText(response));
    if (!result) throw new ReviewFetchError("STRUCTURED_DATA_UNAVAILABLE", "플랫폼 페이지에서 공개 구조화 리뷰 데이터를 찾지 못했습니다.");
    return result;
  }
  throw new ReviewFetchError("REDIRECT", "리디렉션 횟수가 제한을 초과했습니다.");
}
