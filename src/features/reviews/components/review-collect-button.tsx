"use client";

import { useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ReviewFetchStatus } from "../domain/review-collection-state";
import type { ReviewProviderType } from "../domain/listing-provider";
import { collectReviewsAction, type ReviewCollectActionResult } from "../review.actions";

export function ReviewCollectButton({
  roomId,
  provider,
  status,
  onStarted,
  onFinished,
}: {
  roomId: string;
  provider: ReviewProviderType;
  status: ReviewFetchStatus;
  onStarted: () => void;
  onFinished: (result: ReviewCollectActionResult) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const collecting = pending || status === "LOADING";
  const label = collecting
    ? t("reviews.states.collecting")
    : status === "FAILED"
      ? t("reviews.actions.retry")
      : status === "SUCCESS" || status === "EMPTY"
        ? t("reviews.actions.reload")
        : t("reviews.actions.load");

  const collect = () => {
    if (collecting) return;
    onStarted();
    startTransition(async () => {
      try {
        const result = await collectReviewsAction({ roomId, provider });
        onFinished(result);
      } catch {
        onFinished({ status: "FAILED", message: t("reviews.states.requestFailed") });
      } finally {
        router.refresh();
      }
    });
  };

  return <Button
    type="button"
    size="sm"
    variant="outline"
    className="h-7 px-2 text-xs"
    disabled={collecting}
    onClick={collect}
  >
    {collecting ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
    {label}
  </Button>;
}
