import { normalizeListingUrl, validateListingUrl, type ReviewProviderType } from "../domain/listing-provider";
import { fetchStructuredReviewPage } from "./review-page-fetcher";
import type { ReviewProvider } from "./review-provider";

abstract class StructuredReviewProvider implements ReviewProvider {
  abstract readonly provider: ReviewProviderType;

  validateListingUrl(url: string) {
    try { validateListingUrl(this.provider, url); return true; }
    catch { return false; }
  }

  normalizeListingUrl(url: string) {
    return normalizeListingUrl(this.provider, url);
  }

  fetch(input: { listingUrl: string; signal?: AbortSignal }) {
    return fetchStructuredReviewPage({ provider: this.provider, ...input });
  }
}

export class AirbnbReviewProvider extends StructuredReviewProvider {
  readonly provider = "AIRBNB" as const;
}

export class BookingReviewProvider extends StructuredReviewProvider {
  readonly provider = "BOOKING" as const;
}

export class AgodaReviewProvider extends StructuredReviewProvider {
  readonly provider = "AGODA" as const;
}
