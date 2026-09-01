"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PropertyReviewsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return <Card><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
    <TriangleAlert className="size-8 text-destructive" />
    <p className="font-medium">{t("reviews.states.loadError")}</p>
    <Button type="button" variant="outline" onClick={reset}>{t("reviews.actions.retry")}</Button>
  </CardContent></Card>;
}
