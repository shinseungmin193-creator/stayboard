import { Star, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getReviewCollectionState } from "../domain/review-collection-state";
import type { ReviewListingSummary } from "../review.types";
import { ReviewCollectButton } from "./review-collect-button";

export function ReviewSummaryStatus({
  roomId,
  listing,
  compact = false,
}: {
  roomId: string;
  listing?: ReviewListingSummary;
  compact?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  if (!listing) return <p className="text-sm text-muted-foreground">{t("reviews.states.unregistered")}</p>;
  const hasSummary = listing.rating !== null || listing.reviewCount !== null;
  const state = getReviewCollectionState(listing);
  const collectedAt = listing.collectedAt && new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(listing.collectedAt);
  return <div className={compact ? "space-y-0.5" : "space-y-1"}>
    {hasSummary ? <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="inline-flex items-center gap-1 font-semibold tabular-nums"><Star className="size-3.5 fill-amber-400 text-amber-500" />{listing.rating ?? "-"}</span>
      <span className="text-xs text-muted-foreground">{listing.reviewCount === null ? t("reviews.labels.reviewCount", { count: "-" }) : t("reviews.labels.reviewCountValue", { count: listing.reviewCount })}</span>
    </div> : state === "COLLECTED"
      ? <p className="text-xs text-muted-foreground">{t("reviews.states.noSummary")}</p>
      : state !== "COLLECTING" && state !== "FAILED"
        ? <p className="text-xs text-muted-foreground">{t("reviews.states.notCollected")}</p>
        : null}
    {state === "FAILED" && <div className="space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
      <p className="inline-flex items-center gap-1 font-medium"><TriangleAlert className="size-3" />{t("reviews.states.loadFailed")}</p>
      {listing.latestSyncErrorMessage && <p className="break-words">{listing.latestSyncErrorMessage}</p>}
    </div>}
    {!compact && collectedAt && <p className="text-xs text-muted-foreground">{t("reviews.labels.lastCollected", { date: collectedAt })}</p>}
    <ReviewCollectButton roomId={roomId} provider={listing.provider} state={state} />
  </div>;
}
