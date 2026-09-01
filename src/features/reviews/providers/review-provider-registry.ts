import type { ReviewProviderType } from "../domain/listing-provider";
import type { ReviewProvider } from "./review-provider";
import { AgodaReviewProvider, AirbnbReviewProvider, BookingReviewProvider } from "./structured-review-provider";

const providers = new Map<ReviewProviderType, ReviewProvider>([
  ["AIRBNB", new AirbnbReviewProvider()],
  ["BOOKING", new BookingReviewProvider()],
  ["AGODA", new AgodaReviewProvider()],
]);

export function getReviewProvider(provider: ReviewProviderType): ReviewProvider {
  const implementation = providers.get(provider);
  if (!implementation) throw new Error(`지원하지 않는 리뷰 Provider입니다: ${provider}`);
  return implementation;
}

export function listReviewProviders() {
  return [...providers.values()];
}
