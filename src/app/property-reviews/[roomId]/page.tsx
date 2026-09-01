import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AccessDenied, authorizeAccess, PERMISSIONS } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { isReviewProviderType, REVIEW_PROVIDER_TYPES, type ReviewProviderType } from "@/features/reviews/domain/listing-provider";
import { ReviewRoomDetailView } from "@/features/reviews/components/review-room-detail";
import { getReviewRoomDetail } from "@/features/reviews/server/review.repository";

export const dynamic = "force-dynamic";

export default async function PropertyReviewDetailPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ provider?: string | string[] }>;
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  const access = await authorizeAccess(PERMISSIONS.PROPERTY_REVIEW_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const { roomId } = await params;
  const room = await getReviewRoomDetail(access.context, roomId);
  if (!room) notFound();
  const rawProvider = (await searchParams).provider;
  const selectedProvider: ReviewProviderType = typeof rawProvider === "string" && isReviewProviderType(rawProvider)
    ? rawProvider
    : room.listings[0]?.provider ?? REVIEW_PROVIDER_TYPES[0];
  return <div className="space-y-5">
    <Button nativeButton={false} render={<Link href="/property-reviews" />} variant="ghost" size="sm"><ArrowLeft />{t("reviews.actions.back")}</Button>
    <PageHeader title={`${room.propertyName} ${room.name}`} description={t("reviews.description")} />
    <ReviewRoomDetailView room={room} selectedProvider={selectedProvider} locale={locale} />
  </div>;
}
