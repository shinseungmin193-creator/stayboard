import assert from "node:assert/strict";
import test from "node:test";
import { createReviewFingerprint, shouldCreateReviewSnapshot } from "../domain/review-data";
import { getReviewFetchStatus } from "../domain/review-collection-state";
import { parseProviderReviewPage, parseStructuredReviewData } from "../domain/structured-review-data";
import { runIsolatedReviewSyncBatch } from "../domain/review-sync-batch";

const html = `<!doctype html><html><head><script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "Hotel",
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "8.9", "reviewCount": "74" },
  "review": [{
    "@type": "Review",
    "@id": "review-1",
    "author": { "@type": "Person", "name": "Kim" },
    "reviewRating": { "ratingValue": "9" },
    "reviewBody": "위치가 좋고 깨끗했습니다.",
    "datePublished": "2026-08-29"
  }]
}</script></head></html>`;

test("표준 JSON-LD에서 원래 점수, 총 리뷰 수와 리뷰 내용을 추출한다", () => {
  const result = parseStructuredReviewData(html, new Date("2026-09-01T00:00:00Z"));
  assert.ok(result);
  assert.equal(result.rating, "8.9");
  assert.equal(result.reviewCount, 74);
  assert.equal(result.reviews[0]?.rating, "9");
  assert.equal(result.reviews[0]?.content, "위치가 좋고 깨끗했습니다.");
  assert.equal(result.reviews[0]?.reviewedAt?.toISOString(), "2026-08-29T00:00:00.000Z");
});

test("구조화 리뷰 데이터가 없으면 성공 데이터로 위장하지 않는다", () => {
  assert.equal(parseStructuredReviewData("<html><body>review text</body></html>"), null);
  assert.equal(parseStructuredReviewData('<script type="application/ld+json">invalid</script>'), null);
});

const emptyAirbnbListingHtml = `<!doctype html><html><head><script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "VacationRental",
  "identifier": "1717217172042862004",
  "name": "Entire rental unit"
}</script></head><body><script>window.__STATE__={"reviewCount":0,"starRating":0}</script></body></html>`;

test("정상 Airbnb 숙소의 명시적 리뷰 0건은 rating null인 성공 결과다", () => {
  const result = parseProviderReviewPage({
    provider: "AIRBNB",
    listingUrl: "https://www.airbnb.co.kr/rooms/1717217172042862004",
    html: emptyAirbnbListingHtml,
    collectedAt: new Date("2026-09-17T04:00:00.000Z"),
  });
  assert.deepEqual(result, {
    rating: null,
    reviewCount: 0,
    reviews: [],
    collectedAt: new Date("2026-09-17T04:00:00.000Z"),
  });
});

test("Airbnb가 listing identifier를 base64 GraphQL ID로 제공해도 동일 숙소로 확인한다", () => {
  const encodedHtml = emptyAirbnbListingHtml.replace(
    '"identifier": "1717217172042862004"',
    '"identifier": "RGVtYW5kU3RheUxpc3Rpbmc6MTcxNzIxNzE3MjA0Mjg2MjAwNA=="',
  );
  const result = parseProviderReviewPage({
    provider: "AIRBNB",
    listingUrl: "https://www.airbnb.co.kr/rooms/1717217172042862004",
    html: encodedHtml,
  });
  assert.equal(result?.reviewCount, 0);
});

test("숙소 identity 또는 명시적 0건 신호가 없으면 파싱 실패를 유지한다", () => {
  const listingUrl = "https://www.airbnb.com/rooms/1717217172042862004";
  assert.equal(parseProviderReviewPage({ provider: "AIRBNB", listingUrl, html: "<html><title>Access page</title></html>" }), null);
  assert.equal(parseProviderReviewPage({ provider: "AIRBNB", listingUrl, html: emptyAirbnbListingHtml.replace('"reviewCount":0', '"otherCount":0') }), null);
  assert.equal(parseProviderReviewPage({ provider: "AIRBNB", listingUrl: "https://www.airbnb.com/rooms/999", html: emptyAirbnbListingHtml }), null);
});

test("Booking과 Agoda도 정상 숙소 identity와 명시적 리뷰 0건을 성공으로 처리한다", () => {
  const cases = [
    { provider: "BOOKING" as const, listingUrl: "https://www.booking.com/hotel/jp/example.html", type: "Hotel" },
    { provider: "AGODA" as const, listingUrl: "https://www.agoda.com/example/hotel/example.html", type: "LodgingBusiness" },
  ];
  for (const item of cases) {
    const html = `<script type="application/ld+json">{"@type":"${item.type}","name":"Example"}</script><script>{"reviewCount":0}</script>`;
    const result = parseProviderReviewPage({ ...item, html });
    assert.equal(result?.reviewCount, 0);
    assert.equal(result?.rating, null);
    assert.deepEqual(result?.reviews, []);
  }
});

test("providerReviewId가 있으면 내용 변경에도 같은 fingerprint를 사용한다", () => {
  const base = { providerReviewId: "review-1", reviewerName: "A", rating: "5", content: "first", reviewedAt: new Date("2026-01-01") };
  const first = createReviewFingerprint({ provider: "AIRBNB", listingUrl: "https://www.airbnb.com/rooms/1", review: base });
  const second = createReviewFingerprint({ provider: "AIRBNB", listingUrl: "https://www.airbnb.com/rooms/1", review: { ...base, content: "edited" } });
  const otherListing = createReviewFingerprint({ provider: "AIRBNB", listingUrl: "https://www.airbnb.com/rooms/2", review: base });
  assert.equal(first, second);
  assert.notEqual(first, otherListing);
});

test("동일한 별점과 리뷰 수에는 중복 snapshot을 만들지 않는다", () => {
  assert.equal(shouldCreateReviewSnapshot({ rating: "4.86", reviewCount: 128 }, { rating: "4.86", reviewCount: 128 }), false);
  assert.equal(shouldCreateReviewSnapshot({ rating: "4.86", reviewCount: 128 }, { rating: "4.87", reviewCount: 128 }), true);
  assert.equal(shouldCreateReviewSnapshot(null, { rating: null, reviewCount: null }), false);
  assert.equal(shouldCreateReviewSnapshot(null, { rating: null, reviewCount: 0 }), true);
  assert.equal(shouldCreateReviewSnapshot({ rating: null, reviewCount: 0 }, { rating: null, reviewCount: 0 }), false);
});

test("한 Provider 수집 실패가 다른 Provider 결과를 막지 않는다", async () => {
  const results = await runIsolatedReviewSyncBatch({
    targets: ["AIRBNB", "BOOKING", "AGODA"] as const,
    concurrency: 2,
    worker: async (provider) => {
      if (provider === "AIRBNB") throw new Error("blocked");
      return `${provider}:SUCCESS`;
    },
    failure: (provider) => `${provider}:FAILED`,
  });
  assert.deepEqual(results, ["AIRBNB:FAILED", "BOOKING:SUCCESS", "AGODA:SUCCESS"]);
});

const collectionStateFixture = {
  rating: null,
  reviewCount: null,
  collectedAt: null,
  latestSyncStatus: null,
  latestSyncStartedAt: null,
} as const;

test("그란 301처럼 Airbnb 링크만 있고 수집 데이터가 없으면 최초 불러오기 상태다", () => {
  assert.equal(getReviewFetchStatus(collectionStateFixture), "IDLE");
});

test("리뷰 요청 상태는 IDLE·LOADING·SUCCESS·EMPTY·FAILED 중 하나로만 판정한다", () => {
  const now = new Date("2026-09-17T03:00:00.000Z");
  assert.equal(getReviewFetchStatus(collectionStateFixture, now), "IDLE");
  assert.equal(getReviewFetchStatus({
    ...collectionStateFixture,
    latestSyncStatus: "RUNNING",
    latestSyncStartedAt: new Date("2026-09-17T02:59:00.000Z"),
  }, now), "LOADING");
  assert.equal(getReviewFetchStatus({
    ...collectionStateFixture,
    rating: "4.82",
    reviewCount: 137,
    collectedAt: new Date("2026-09-17T02:00:00.000Z"),
    latestSyncStatus: "SUCCESS",
  }, now), "SUCCESS");
  assert.equal(getReviewFetchStatus({
    ...collectionStateFixture,
    rating: null,
    reviewCount: 0,
    collectedAt: new Date("2026-09-17T02:00:00.000Z"),
    latestSyncStatus: "SUCCESS",
  }, now), "EMPTY");
  assert.equal(getReviewFetchStatus({
    ...collectionStateFixture,
    latestSyncStatus: "FAILED",
    latestSyncStartedAt: new Date("2026-09-17T02:00:00.000Z"),
  }, now), "FAILED");
});

test("진행·실패 상태는 이전 성공 snapshot보다 우선해 충돌 표시를 막는다", () => {
  const now = new Date("2026-09-17T03:00:00.000Z");
  const previousSuccess = {
    ...collectionStateFixture,
    rating: "4.82",
    reviewCount: 137,
    collectedAt: new Date("2026-09-17T02:00:00.000Z"),
  };
  assert.equal(getReviewFetchStatus({
    ...previousSuccess,
    latestSyncStatus: "RUNNING",
    latestSyncStartedAt: new Date("2026-09-17T02:59:00.000Z"),
  }, now), "LOADING");
  assert.equal(getReviewFetchStatus({ ...previousSuccess, latestSyncStatus: "FAILED" }, now), "FAILED");
  assert.equal(getReviewFetchStatus({ ...previousSuccess, reviewCount: 0, latestSyncStatus: "FAILED" }, now), "FAILED");
});
