import assert from "node:assert/strict";
import test from "node:test";
import { createReviewFingerprint, shouldCreateReviewSnapshot } from "../domain/review-data";
import { parseStructuredReviewData } from "../domain/structured-review-data";
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
