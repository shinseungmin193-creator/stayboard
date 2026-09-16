"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { collectReviewListingsAction } from "../review.actions";

export function ReviewBulkCollectButton({ listingIds }: { listingIds: string[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const collect = () => {
    if (pending || !listingIds.length) return;
    setMessage(null);
    startTransition(async () => {
      const result = await collectReviewListingsAction({ listingIds });
      setMessage({ text: result.message, success: result.success });
      router.refresh();
    });
  };
  return <div className="flex flex-col items-stretch gap-1 sm:items-end">
    <Button type="button" onClick={collect} disabled={pending || !listingIds.length}>
      {pending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
      {pending ? t("reviews.actions.collectingAll") : t("reviews.actions.collectAll")}
    </Button>
    {message && <p role={message.success ? "status" : "alert"} className={`max-w-80 text-xs ${message.success ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>{message.text}</p>}
  </div>;
}
