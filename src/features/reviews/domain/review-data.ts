import { createHash } from "node:crypto";
import type { ReviewProviderType } from "./listing-provider";

export interface CollectedListingReview {
  providerReviewId: string | null;
  reviewerName: string | null;
  rating: string | null;
  content: string | null;
  reviewedAt: Date | null;
}

export interface ReviewCollectionResult {
  rating: string | null;
  reviewCount: number | null;
  reviews: CollectedListingReview[];
  collectedAt: Date;
}

const fingerprintPart = (value: string | Date | null) => value instanceof Date ? value.toISOString() : value?.trim() ?? "";

export function createReviewFingerprint(input: {
  provider: ReviewProviderType;
  listingUrl: string;
  review: CollectedListingReview;
}) {
  const identity = input.review.providerReviewId
    ? ["provider-id", input.review.providerReviewId]
    : [
        "content",
        fingerprintPart(input.review.reviewedAt),
        fingerprintPart(input.review.reviewerName),
        fingerprintPart(input.review.rating),
        fingerprintPart(input.review.content),
      ];
  return createHash("sha256")
    .update(JSON.stringify([input.provider, input.listingUrl, ...identity]))
    .digest("hex");
}

export function shouldCreateReviewSnapshot(
  latest: { rating: string | null; reviewCount: number | null } | null,
  incoming: { rating: string | null; reviewCount: number | null },
) {
  if (incoming.rating === null && incoming.reviewCount === null) return false;
  return !latest || latest.rating !== incoming.rating || latest.reviewCount !== incoming.reviewCount;
}
