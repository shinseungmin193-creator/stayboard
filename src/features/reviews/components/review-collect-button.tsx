"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RegisteredReviewCollectionState } from "../domain/review-collection-state";
import type { ReviewProviderType } from "../domain/listing-provider";
import { collectReviewsAction } from "../review.actions";

export function ReviewCollectButton({
  roomId,
  provider,
  state,
}: {
  roomId: string;
  provider: ReviewProviderType;
  state: RegisteredReviewCollectionState;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const collecting = pending || state === "COLLECTING";
  const label = collecting
    ? t("reviews.states.collecting")
    : state === "FAILED"
      ? t("reviews.actions.retry")
      : state === "COLLECTED"
        ? t("reviews.actions.reload")
        : t("reviews.actions.load");

  const collect = () => {
    if (collecting) return;
    setMessage(null);
    startTransition(async () => {
      const result = await collectReviewsAction({ roomId, provider });
      setMessage({ text: result.message, success: result.success || Boolean(result.alreadyRunningCount) });
      router.refresh();
    });
  };

  return <div className="space-y-1">
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      disabled={collecting}
      onClick={collect}
    >
      {collecting ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
      {label}
    </Button>
    {message && <p
      role={message.success ? "status" : "alert"}
      className={`max-w-56 text-xs ${message.success ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}
    >{message.text}</p>}
  </div>;
}
