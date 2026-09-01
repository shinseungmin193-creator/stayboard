import { getTranslations } from "next-intl/server";
import { AccessDenied, authorizeAccess, companyScopeIds, PERMISSIONS } from "@/features/access-control";
import { PageHeader } from "@/components/shared/page-header";
import { listPropertyOptions } from "@/features/properties";
import { isReviewProviderType, type ReviewProviderType } from "@/features/reviews/domain/listing-provider";
import { ReviewFilters } from "@/features/reviews/components/review-filters";
import { ReviewPagination } from "@/features/reviews/components/review-pagination";
import { ReviewRoomList } from "@/features/reviews/components/review-room-list";
import { listReviewRooms } from "@/features/reviews/server/review.repository";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("navigation.items.property-reviews") };
}

export default async function PropertyReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.PROPERTY_REVIEW_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const properties = await listPropertyOptions(companyScopeIds(access.context), access.context.scope);
  const requestedPropertyId = value("propertyId");
  const propertyId = properties.some((item) => item.id === requestedPropertyId) ? requestedPropertyId : undefined;
  const providerValue = value("provider");
  const provider: ReviewProviderType | undefined = providerValue && isReviewProviderType(providerValue) ? providerValue : undefined;
  const query = value("query")?.trim().slice(0, 100) || undefined;
  const parsedPage = Number(value("page"));
  const result = await listReviewRooms(access.context, { propertyId, query, page: Number.isSafeInteger(parsedPage) ? parsedPage : 1 });
  const listingIds = result.rooms.flatMap((room) => room.listings)
    .filter((listing) => !provider || listing.provider === provider)
    .map((listing) => listing.id);
  return <div className="space-y-5">
    <PageHeader eyebrow="REVIEWS" title={t("navigation.items.property-reviews")} description={t("reviews.description")} />
    <ReviewFilters properties={properties} propertyId={propertyId} provider={provider} query={query} listingIds={listingIds} />
    {!listingIds.length && result.rooms.length > 0 && <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">{t("reviews.states.noLinks")}</div>}
    <ReviewRoomList rooms={result.rooms} provider={provider} />
    <ReviewPagination page={result.page} totalPages={result.totalPages} params={{ propertyId, provider, query }} />
  </div>;
}
