import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { REVIEW_PROVIDER_CONFIG, type ReviewProviderType } from "../domain/listing-provider";
import { ReviewRefreshButton } from "./review-refresh-button";

export function ReviewFilters({ properties, propertyId, provider, query, listingIds }: {
  properties: Array<{ id: string; name: string; isActive: boolean }>;
  propertyId?: string;
  provider?: ReviewProviderType;
  query?: string;
  listingIds: string[];
}) {
  const t = useTranslations();
  return <div className="grid gap-2 rounded-xl border bg-card p-3 lg:grid-cols-[minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(220px,1.4fr)_auto] lg:items-end">
    <form method="get" className="contents">
      <label className="grid gap-1 text-xs font-medium">{t("reviews.filters.property")}
        <select name="propertyId" defaultValue={propertyId ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">{t("reviews.filters.allProperties")}</option>
          {properties.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium">{t("reviews.filters.provider")}
        <select name="provider" defaultValue={provider ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">{t("reviews.filters.allProviders")}</option>
          {REVIEW_PROVIDER_CONFIG.map((item) => <option key={item.provider} value={item.provider}>{item.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium">{t("reviews.filters.search")}
        <span className="flex gap-2"><span className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><input name="query" defaultValue={query ?? ""} placeholder={t("reviews.filters.searchPlaceholder")} className="h-9 w-full rounded-md border border-input bg-background pr-2 pl-9 text-sm" /></span><Button type="submit" variant="outline">{t("reviews.filters.apply")}</Button></span>
      </label>
    </form>
    <ReviewRefreshButton listingIds={listingIds} />
  </div>;
}
