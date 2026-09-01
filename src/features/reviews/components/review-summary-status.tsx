import { LoaderCircle, Star, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReviewListingSummary } from "../review.types";

export function ReviewSummaryStatus({ listing, compact = false }: { listing?: ReviewListingSummary; compact?: boolean }) {
  const t = useTranslations();
  if (!listing) return <p className="text-sm text-muted-foreground">{t("reviews.states.unregistered")}</p>;
  const hasSummary = listing.rating !== null || listing.reviewCount !== null;
  return <div className={compact ? "space-y-0.5" : "space-y-1"}>
    {hasSummary ? <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="inline-flex items-center gap-1 font-semibold tabular-nums"><Star className="size-3.5 fill-amber-400 text-amber-500" />{listing.rating ?? "-"}</span>
      <span className="text-xs text-muted-foreground">{listing.reviewCount === null ? t("reviews.labels.reviewCount", { count: "-" }) : t("reviews.labels.reviewCountValue", { count: listing.reviewCount })}</span>
    </div> : <p className="text-xs text-muted-foreground">{t("reviews.states.notCollected")}</p>}
    {listing.latestSyncStatus === "RUNNING" && <p className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300"><LoaderCircle className="size-3 animate-spin" />{t("reviews.states.collecting")}</p>}
    {(listing.latestSyncStatus === "FAILED" || listing.latestSyncStatus === "TIMEOUT") && <p className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><TriangleAlert className="size-3" />{t("reviews.states.lastFailed")}</p>}
  </div>;
}
