import { REVIEW_SYNC_STALE_RUNNING_MS } from "../review.constants";

export type ReviewCollectionState =
  | "UNREGISTERED"
  | "NOT_COLLECTED"
  | "COLLECTING"
  | "COLLECTED"
  | "FAILED";

type RegisteredReviewCollectionInput = {
  rating: string | null;
  reviewCount: number | null;
  collectedAt: Date | null;
  latestSyncStatus: "RUNNING" | "SUCCESS" | "FAILED" | "TIMEOUT" | null;
  latestSyncStartedAt: Date | null;
};

export type RegisteredReviewCollectionState = Exclude<ReviewCollectionState, "UNREGISTERED">;

export function getReviewCollectionState(listing: undefined, now?: Date): "UNREGISTERED";
export function getReviewCollectionState(listing: RegisteredReviewCollectionInput, now?: Date): RegisteredReviewCollectionState;
export function getReviewCollectionState(
  listing: RegisteredReviewCollectionInput | undefined,
  now = new Date(),
): ReviewCollectionState {
  if (!listing) return "UNREGISTERED";
  if (listing.latestSyncStatus === "RUNNING") {
    const startedAt = listing.latestSyncStartedAt?.getTime();
    if (startedAt !== undefined && now.getTime() - startedAt < REVIEW_SYNC_STALE_RUNNING_MS) {
      return "COLLECTING";
    }
    return "FAILED";
  }
  if (listing.latestSyncStatus === "FAILED" || listing.latestSyncStatus === "TIMEOUT") return "FAILED";
  if (
    listing.rating !== null
    || listing.reviewCount !== null
    || listing.collectedAt !== null
    || listing.latestSyncStatus === "SUCCESS"
  ) return "COLLECTED";
  return "NOT_COLLECTED";
}
