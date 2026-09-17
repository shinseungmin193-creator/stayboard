"use client";

import { useState } from "react";
import { Star, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getReviewFetchStatus } from "../domain/review-collection-state";
import type { ReviewCollectActionResult } from "../review.actions";
import type { ReviewListingSummary } from "../review.types";
import { ReviewCollectButton } from "./review-collect-button";

export function ReviewSummaryStatus({
  roomId,
  listing,
  compact = false,
}: {
  roomId: string;
  listing: ReviewListingSummary;
  compact?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [requestResult, setRequestResult] = useState<ReviewCollectActionResult | null>(null);
  const displayedListing = requestResult?.listing ?? listing;
  const status = requestResult?.status ?? getReviewFetchStatus(displayedListing);
  const collectedAt = displayedListing.collectedAt && new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(displayedListing.collectedAt);
  return <div className={compact ? "space-y-0.5" : "space-y-1"}>
    {status === "IDLE" && <p className="text-xs text-muted-foreground">{t("reviews.states.notCollected")}</p>}
    {status === "LOADING" && <p className="text-xs font-medium text-muted-foreground">{t("reviews.states.collecting")}</p>}
    {status === "EMPTY" && <p className="text-xs font-medium text-muted-foreground">{t("reviews.states.noReviews")}</p>}
    {status === "SUCCESS" && (displayedListing.rating !== null || displayedListing.reviewCount !== null
      ? <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1 font-semibold tabular-nums"><Star className="size-3.5 fill-amber-400 text-amber-500" />{displayedListing.rating ?? "-"}</span>
        <span className="text-xs text-muted-foreground">{displayedListing.reviewCount === null ? t("reviews.labels.reviewCount", { count: "-" }) : t("reviews.labels.reviewCountValue", { count: displayedListing.reviewCount })}</span>
      </div>
      : <p className="text-xs text-muted-foreground">{t("reviews.states.noSummary")}</p>)}
    {status === "FAILED" && <div className="space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
      <p className="inline-flex items-center gap-1 font-medium"><TriangleAlert className="size-3" />{t("reviews.states.loadFailed")}</p>
      {(requestResult?.message ?? displayedListing.latestSyncErrorMessage) && <p className="break-words">{requestResult?.message ?? displayedListing.latestSyncErrorMessage}</p>}
    </div>}
    {!compact && (status === "SUCCESS" || status === "EMPTY") && collectedAt && <p className="text-xs text-muted-foreground">{t("reviews.labels.lastCollected", { date: collectedAt })}</p>}
    <ReviewCollectButton
      roomId={roomId}
      provider={displayedListing.provider}
      status={status}
      onStarted={() => setRequestResult({ status: "LOADING", message: "" })}
      onFinished={setRequestResult}
    />
  </div>;
}
