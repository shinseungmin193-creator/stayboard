"use client";

import { FieldError } from "@/components/shared/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REVIEW_PROVIDER_CONFIG, type ReviewProviderType } from "@/features/reviews/domain/listing-provider";
import { listingUrlField } from "../room-listing";

export type RoomListingUrlValues = Record<ReviewProviderType, string>;

export const EMPTY_ROOM_LISTING_URLS: RoomListingUrlValues = {
  AIRBNB: "",
  BOOKING: "",
  AGODA: "",
};

export function RoomListingFields({
  idPrefix,
  values,
  onChange,
  fieldErrors,
}: {
  idPrefix: string;
  values?: RoomListingUrlValues;
  onChange?: (provider: ReviewProviderType, value: string) => void;
  fieldErrors?: Record<string, string[]>;
}) {
  return <div className="grid gap-3">
    {REVIEW_PROVIDER_CONFIG.map((item) => {
      const field = listingUrlField(item.provider);
      const controlled = values !== undefined;
      return <div key={item.provider} className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-${item.provider}`}>{item.label}</Label>
        <Input
          id={`${idPrefix}-${item.provider}`}
          name={field}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={item.placeholder}
          maxLength={2048}
          value={controlled ? values[item.provider] : undefined}
          onChange={controlled ? (event) => onChange?.(item.provider, event.target.value) : undefined}
        />
        <FieldError errors={fieldErrors?.[field]} />
      </div>;
    })}
  </div>;
}
