"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ReviewProviderType } from "../domain/listing-provider";
import type { ReviewListingSummary } from "../review.types";
import { ReviewListingRegistrationDialog } from "./review-listing-registration-dialog";
import { ReviewSummaryStatus } from "./review-summary-status";

export function ReviewPlatformCell({
  roomId,
  roomLabel,
  provider,
  initialListing,
  compact = false,
}: {
  roomId: string;
  roomLabel: string;
  provider: ReviewProviderType;
  initialListing?: ReviewListingSummary;
  compact?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [registeredListing, setRegisteredListing] = useState<ReviewListingSummary | null>(null);
  const listing = initialListing ?? registeredListing ?? undefined;

  if (listing) return <ReviewSummaryStatus roomId={roomId} listing={listing} compact={compact} />;

  return <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
    <span className="text-sm text-muted-foreground">{t("reviews.states.unregistered")}</span>
    <ReviewListingRegistrationDialog
      roomId={roomId}
      roomLabel={roomLabel}
      provider={provider}
      onRegistered={(created) => {
        setRegisteredListing(created);
        router.refresh();
      }}
    />
  </div>;
}
