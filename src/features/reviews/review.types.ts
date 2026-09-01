import type { ReviewProviderType } from "./domain/listing-provider";

export interface ReviewListingSummary {
  id: string;
  provider: ReviewProviderType;
  rating: string | null;
  reviewCount: number | null;
  collectedAt: Date | null;
  latestSyncStatus: "RUNNING" | "SUCCESS" | "FAILED" | "TIMEOUT" | null;
  latestSyncErrorCode: string | null;
  latestSyncErrorMessage: string | null;
  latestSyncStartedAt: Date | null;
  latestSyncFinishedAt: Date | null;
}

export interface ReviewRoomListItem {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
  listings: ReviewListingSummary[];
}

export interface ReviewRoomPage {
  rooms: ReviewRoomListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListingReviewItem {
  id: string;
  reviewerName: string | null;
  rating: string | null;
  content: string | null;
  reviewedAt: Date | null;
  collectedAt: Date;
}

export interface ReviewRoomDetail {
  id: string;
  name: string;
  propertyName: string;
  listings: Array<ReviewListingSummary & { reviews: ListingReviewItem[] }>;
}

export interface ReviewSyncTarget {
  id: string;
  roomId: string;
  provider: ReviewProviderType;
  listingUrl: string;
}
