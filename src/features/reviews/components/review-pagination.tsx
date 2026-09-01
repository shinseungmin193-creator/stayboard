import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

function pageHref(page: number, params: { propertyId?: string; provider?: string; query?: string }) {
  const search = new URLSearchParams();
  if (params.propertyId) search.set("propertyId", params.propertyId);
  if (params.provider) search.set("provider", params.provider);
  if (params.query) search.set("query", params.query);
  if (page > 1) search.set("page", String(page));
  const value = search.toString();
  return value ? `/property-reviews?${value}` : "/property-reviews";
}

export function ReviewPagination({ page, totalPages, params }: { page: number; totalPages: number; params: { propertyId?: string; provider?: string; query?: string } }) {
  const t = useTranslations();
  if (totalPages <= 1) return null;
  return <nav aria-label={t("reviews.labels.pagination")} className="flex items-center justify-center gap-3">
    <Button nativeButton={false} render={<Link href={pageHref(page - 1, params)} aria-disabled={page <= 1} />} variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}><ChevronLeft />{t("reviews.actions.previous")}</Button>
    <span className="text-sm tabular-nums text-muted-foreground">{t("reviews.labels.page", { page, totalPages })}</span>
    <Button nativeButton={false} render={<Link href={pageHref(page + 1, params)} aria-disabled={page >= totalPages} />} variant="outline" size="sm" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>{t("reviews.actions.next")}<ChevronRight /></Button>
  </nav>;
}
