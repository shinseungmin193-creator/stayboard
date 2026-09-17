"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Link2, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROOM_LISTING_URL_MAX_LENGTH } from "@/features/rooms/room-listing";
import { getReviewProviderLabel, REVIEW_PROVIDER_CONFIG, type ReviewProviderType } from "../domain/listing-provider";
import { registerReviewListingAction } from "../review.actions";
import type { ReviewListingSummary } from "../review.types";

export function ReviewListingRegistrationDialog({
  roomId,
  roomLabel,
  provider,
  onRegistered,
}: {
  roomId: string;
  roomLabel: string;
  provider: ReviewProviderType;
  onRegistered: (listing: ReviewListingSummary) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [listingUrl, setListingUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<string[] | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const providerLabel = getReviewProviderLabel(provider);
  const placeholder = REVIEW_PROVIDER_CONFIG.find((item) => item.provider === provider)?.placeholder;
  const inputId = `review-listing-url-${roomId}-${provider}`;

  const changeOpen = (nextOpen: boolean) => {
    if (pending) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setListingUrl("");
      setFieldErrors(undefined);
      setMessage(null);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setFieldErrors(undefined);
    setMessage(null);
    startTransition(async () => {
      const result = await registerReviewListingAction({ roomId, provider, listingUrl });
      if (!result.success) {
        setFieldErrors(result.fieldErrors?.listingUrl);
        setMessage(result.message);
        return;
      }
      if (!result.data) {
        setMessage(t("reviews.registration.failed"));
        return;
      }
      onRegistered(result.data);
      setOpen(false);
      setListingUrl("");
      setFieldErrors(undefined);
      setMessage(null);
    });
  };

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger render={<Button type="button" size="xs" variant="outline" />}>
      <Link2 />
      {t("reviews.actions.register")}
    </DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{t("reviews.registration.title", { provider: providerLabel })}</DialogTitle>
        <DialogDescription>{t("reviews.registration.description", { room: roomLabel, provider: providerLabel })}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
          <dt className="text-muted-foreground">{t("reviews.registration.room")}</dt>
          <dd className="font-medium">{roomLabel}</dd>
          <dt className="text-muted-foreground">{t("reviews.registration.provider")}</dt>
          <dd className="font-medium">{providerLabel}</dd>
        </dl>
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>{t("reviews.registration.url")}</Label>
          <Input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={ROOM_LISTING_URL_MAX_LENGTH}
            placeholder={placeholder}
            value={listingUrl}
            onChange={(event) => setListingUrl(event.target.value)}
            aria-invalid={Boolean(fieldErrors?.length)}
            disabled={pending}
            required
            autoFocus
          />
          <FieldError errors={fieldErrors} />
        </div>
        {message && <p role="alert" className="text-xs text-destructive">{message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={pending}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={pending || !listingUrl.trim()}>
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? t("reviews.actions.registering") : t("reviews.actions.register")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
