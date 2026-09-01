import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REVIEW_PROVIDER_CONFIG, type ReviewProviderType } from "../domain/listing-provider";
import type { ReviewRoomListItem } from "../review.types";
import { ReviewSummaryStatus } from "./review-summary-status";

export function ReviewRoomList({ rooms, provider }: { rooms: ReviewRoomListItem[]; provider?: ReviewProviderType }) {
  const t = useTranslations();
  const providers = provider ? REVIEW_PROVIDER_CONFIG.filter((item) => item.provider === provider) : REVIEW_PROVIDER_CONFIG;
  if (!rooms.length) return <Card><CardContent className="flex min-h-64 flex-col items-center justify-center gap-2 text-center"><Star className="size-8 text-muted-foreground" /><p className="font-medium">{t("reviews.states.noRooms")}</p><p className="text-sm text-muted-foreground">{t("reviews.states.changeFilters")}</p></CardContent></Card>;
  return <>
    <div className="grid gap-3 md:hidden">
      {rooms.map((room) => <Card key={room.id}><CardContent className="space-y-4 p-4">
        <div><p className="font-semibold">{room.propertyName} {room.name}</p><p className="text-xs text-muted-foreground">{t("reviews.labels.storedData")}</p></div>
        <div className="grid gap-3">{providers.map((item) => <div key={item.provider} className="grid grid-cols-[110px_1fr] gap-2 rounded-lg border bg-muted/20 p-2.5"><p className="text-sm font-medium">{item.label}</p><ReviewSummaryStatus listing={room.listings.find((listing) => listing.provider === item.provider)} /></div>)}</div>
        <Button nativeButton={false} render={<Link href={`/property-reviews/${room.id}`} />} variant="outline" className="w-full">{t("reviews.actions.recentReviews")}<ArrowRight /></Button>
      </CardContent></Card>)}
    </div>
    <Card className="hidden overflow-hidden md:block"><Table><TableHeader><TableRow><TableHead className="min-w-48">{t("reviews.filters.property")}</TableHead>{providers.map((item) => <TableHead key={item.provider} className="min-w-44">{item.label}</TableHead>)}<TableHead className="w-28" /></TableRow></TableHeader><TableBody>{rooms.map((room) => <TableRow key={room.id}><TableCell><p className="font-medium">{room.propertyName} {room.name}</p></TableCell>{providers.map((item) => <TableCell key={item.provider}><ReviewSummaryStatus compact listing={room.listings.find((listing) => listing.provider === item.provider)} /></TableCell>)}<TableCell><Button nativeButton={false} render={<Link href={`/property-reviews/${room.id}`} />} size="sm" variant="ghost">{t("reviews.actions.details")}<ArrowRight /></Button></TableCell></TableRow>)}</TableBody></Table></Card>
  </>;
}
