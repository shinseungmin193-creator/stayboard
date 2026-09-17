import { REVIEW_SYNC_STALE_RUNNING_MS } from "../review.constants";

export type ReviewFetchStatus =
  | "IDLE"
  | "LOADING"
  | "SUCCESS"
  | "EMPTY"
  | "FAILED";

type RegisteredReviewCollectionInput = {
  rating: string | null;
  reviewCount: number | null;
  collectedAt: Date | null;
  latestSyncStatus: "RUNNING" | "SUCCESS" | "FAILED" | "TIMEOUT" | null;
  latestSyncStartedAt: Date | null;
};

export function getReviewFetchStatus(
  listing: RegisteredReviewCollectionInput,
  now = new Date(),
): ReviewFetchStatus {
  if (listing.latestSyncStatus === "RUNNING") {
    const startedAt = listing.latestSyncStartedAt?.getTime();
    if (startedAt !== undefined && now.getTime() - startedAt < REVIEW_SYNC_STALE_RUNNING_MS) {
      return "LOADING";
    }
    return "FAILED";
  }
  if (listing.latestSyncStatus === "FAILED" || listing.latestSyncStatus === "TIMEOUT") return "FAILED";
  if (listing.reviewCount === 0) return "EMPTY";
  if (
    listing.rating !== null
    || listing.reviewCount !== null
    || listing.collectedAt !== null
    || listing.latestSyncStatus === "SUCCESS"
  ) return "SUCCESS";
  return "IDLE";
}
