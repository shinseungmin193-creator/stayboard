import Link from "next/link";
import { CalendarDays, Star, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REVIEW_PROVIDER_CONFIG, type ReviewProviderType } from "../domain/listing-provider";
import type { ReviewRoomDetail } from "../review.types";
import { ReviewRefreshButton } from "./review-refresh-button";
import { ReviewSummaryStatus } from "./review-summary-status";

export function ReviewRoomDetailView({ room, selectedProvider, locale }: {
  room: ReviewRoomDetail;
  selectedProvider: ReviewProviderType;
  locale: string;
}) {
  const t = useTranslations();
  const selected = room.listings.find((listing) => listing.provider === selectedProvider);
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium", timeZone: "Asia/Tokyo" });
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      {REVIEW_PROVIDER_CONFIG.map((provider) => <Card key={provider.provider}><CardHeader className="pb-2"><CardTitle className="text-sm">{provider.label}</CardTitle></CardHeader><CardContent><ReviewSummaryStatus listing={room.listings.find((listing) => listing.provider === provider.provider)} /></CardContent></Card>)}
    </div>
    <div className="flex flex-col gap-3 border-b sm:flex-row sm:items-end sm:justify-between">
      <nav className="flex gap-1 overflow-x-auto" aria-label={t("reviews.labels.providerNavigation")}>
        {REVIEW_PROVIDER_CONFIG.map((provider) => <Link key={provider.provider} href={`/property-reviews/${room.id}?provider=${provider.provider}`} className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${selectedProvider === provider.provider ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{provider.label}</Link>)}
      </nav>
      <div className="pb-2"><ReviewRefreshButton listingIds={selected ? [selected.id] : []} label={t("reviews.actions.refreshReviews")} /></div>
    </div>
    {!selected ? <Card><CardContent className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">{t("reviews.states.providerMissing")}</CardContent></Card> : <div className="space-y-3">
      {(selected.latestSyncStatus === "FAILED" || selected.latestSyncStatus === "TIMEOUT") && <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">{t("reviews.states.preservedAfterFailure")}</p>{selected.latestSyncErrorMessage && <p className="mt-0.5 text-xs">{selected.latestSyncErrorMessage}</p>}</div></div>}
      {!selected.reviews.length ? <Card><CardContent className="flex min-h-52 flex-col items-center justify-center gap-2 text-center"><Star className="size-7 text-muted-foreground" /><p className="font-medium">{t("reviews.states.noReviewContent")}</p><p className="text-sm text-muted-foreground">{t("reviews.states.noPublicContent")}</p></CardContent></Card> : selected.reviews.map((review) => <Card key={review.id}><CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {review.rating !== null && <Badge variant="secondary" className="gap-1"><Star className="size-3 fill-amber-400 text-amber-500" />{review.rating}</Badge>}
          <span className="font-medium">{review.reviewerName ?? t("reviews.labels.unknownReviewer")}</span>
          {review.reviewedAt && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3" />{formatter.format(review.reviewedAt)}</span>}
        </div>
        {review.content && <p className="whitespace-pre-wrap break-words text-sm leading-6">{review.content}</p>}
      </CardContent></Card>)}
    </div>}
  </div>;
}
