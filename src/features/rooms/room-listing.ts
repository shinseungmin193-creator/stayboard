import {
  extractExternalListingId,
  ListingUrlError,
  normalizeListingUrl,
  REVIEW_PROVIDER_CONFIG,
  REVIEW_PROVIDER_TYPES,
  type ReviewProviderType,
} from "../reviews/domain/listing-provider";

export const ROOM_LISTING_URL_MAX_LENGTH = 2048;

export interface RoomListingDraft {
  provider: ReviewProviderType;
  listingUrl: string;
}

export interface NormalizedRoomListing {
  provider: ReviewProviderType;
  listingUrl: string;
  externalListingId: string | null;
}

export const listingUrlField = (provider: ReviewProviderType) => `listingUrl_${provider}`;

export function normalizeRoomListingDrafts(drafts: readonly RoomListingDraft[]): NormalizedRoomListing[] {
  const submitted = new Set<ReviewProviderType>();
  const normalized: NormalizedRoomListing[] = [];
  for (const draft of drafts) {
    if (submitted.has(draft.provider)) throw new ListingUrlError(draft.provider, "INVALID_URL");
    submitted.add(draft.provider);
    const value = draft.listingUrl.trim();
    if (!value) continue;
    if (value.length > ROOM_LISTING_URL_MAX_LENGTH) throw new ListingUrlError(draft.provider, "INVALID_URL");
    const listingUrl = normalizeListingUrl(draft.provider, value);
    normalized.push({
      provider: draft.provider,
      listingUrl,
      externalListingId: extractExternalListingId(draft.provider, listingUrl),
    });
  }
  return normalized;
}

export function roomListingDraftsFromFormData(formData: FormData): RoomListingDraft[] {
  return REVIEW_PROVIDER_CONFIG.map(({ provider }) => ({
    provider,
    listingUrl: String(formData.get(listingUrlField(provider)) ?? ""),
  }));
}

export function hasCompleteRoomListingSubmission(drafts: readonly RoomListingDraft[]) {
  return drafts.length === REVIEW_PROVIDER_TYPES.length
    && new Set(drafts.map((draft) => draft.provider)).size === REVIEW_PROVIDER_TYPES.length
    && REVIEW_PROVIDER_TYPES.every((provider) => drafts.some((draft) => draft.provider === provider));
}

export interface CurrentRoomListing {
  id: string;
  provider: ReviewProviderType;
  listingUrl: string;
  isActive: boolean;
}

export interface RoomListingWritePlan {
  listingCreates: NormalizedRoomListing[];
  listingUpdates: Array<NormalizedRoomListing & { id: string; isActive: true }>;
  listingDeactivations: Array<{ id: string }>;
}

export function planRoomListingWrites(
  drafts: readonly RoomListingDraft[],
  current: readonly CurrentRoomListing[],
): RoomListingWritePlan {
  if (!hasCompleteRoomListingSubmission(drafts)) {
    throw new Error("ROOM_LISTING_SUBMISSION_INCOMPLETE");
  }
  const normalized = normalizeRoomListingDrafts(drafts);
  const submittedByProvider = new Map(normalized.map((listing) => [listing.provider, listing]));
  const currentByProvider = new Map(current.map((listing) => [listing.provider, listing]));
  const listingCreates: NormalizedRoomListing[] = [];
  const listingUpdates: RoomListingWritePlan["listingUpdates"] = [];
  const listingDeactivations: RoomListingWritePlan["listingDeactivations"] = [];

  for (const provider of REVIEW_PROVIDER_TYPES) {
    const submitted = submittedByProvider.get(provider);
    const existing = currentByProvider.get(provider);
    if (!submitted) {
      if (existing?.isActive) listingDeactivations.push({ id: existing.id });
      continue;
    }
    if (!existing) listingCreates.push(submitted);
    else listingUpdates.push({ ...submitted, id: existing.id, isActive: true });
  }
  return { listingCreates, listingUpdates, listingDeactivations };
}
