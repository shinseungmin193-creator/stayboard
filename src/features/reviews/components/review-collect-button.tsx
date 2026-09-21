"use client";

import { useRef, useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { isReviewFetchLoading, type ReviewFetchStatus } from "../domain/review-collection-state";
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
  const requestInFlight = useRef(false);
  const [, startTransition] = useTransition();
  const collecting = isReviewFetchLoading(status);
  const label = collecting
    ? t("reviews.states.collecting")
    : status === "FAILED"
      ? t("reviews.actions.retry")
      : status === "SUCCESS" || status === "EMPTY"
        ? t("reviews.actions.reload")
        : t("reviews.actions.load");

  const collect = () => {
    if (requestInFlight.current || collecting) return;
    requestInFlight.current = true;
    onStarted();
    startTransition(async () => {
      let result: ReviewCollectActionResult = {
        status: "FAILED",
        message: t("reviews.states.requestFailed"),
      };
      try {
        result = await collectReviewsAction({ roomId, provider });
      } catch {
        // The initialized failure result is applied in finally.
      } finally {
        requestInFlight.current = false;
        onFinished(result);
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
