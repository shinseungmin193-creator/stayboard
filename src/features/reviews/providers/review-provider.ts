import type { ReviewCollectionResult } from "../domain/review-data";
import type { ReviewProviderType } from "../domain/listing-provider";

export interface ReviewProvider {
  readonly provider: ReviewProviderType;
  validateListingUrl(url: string): boolean;
  normalizeListingUrl(url: string): string;
  fetch(input: { listingUrl: string; signal?: AbortSignal }): Promise<ReviewCollectionResult>;
}

export type ReviewProviderFetcher = (input: {
  provider: ReviewProviderType;
  listingUrl: string;
  signal?: AbortSignal;
}) => Promise<ReviewCollectionResult>;
