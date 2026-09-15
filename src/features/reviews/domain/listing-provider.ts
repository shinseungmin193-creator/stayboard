import type { CalendarProviderType } from "@/lib/generated/prisma/enums";

export const REVIEW_PROVIDER_TYPES = ["AIRBNB", "BOOKING", "AGODA"] as const;
export type ReviewProviderType = (typeof REVIEW_PROVIDER_TYPES)[number];

export const REVIEW_PROVIDER_CONFIG = [
  { provider: "AIRBNB", label: "Airbnb", hostname: "airbnb.com", placeholder: "https://www.airbnb.com/rooms/123456" },
  { provider: "BOOKING", label: "Booking.com", hostname: "booking.com", placeholder: "https://www.booking.com/hotel/jp/example.html" },
  { provider: "AGODA", label: "Agoda", hostname: "agoda.com", placeholder: "https://www.agoda.com/example/hotel/example.html" },
] as const satisfies ReadonlyArray<{
  provider: ReviewProviderType;
  label: string;
  hostname: string;
  placeholder: string;
}>;

const LISTING_PROVIDER_HOSTNAMES = {
  AIRBNB: [
    "airbnb.com",
    "airbnb.co.kr",
    "airbnb.co.jp",
    "airbnb.co.uk",
    "airbnb.fr",
    "airbnb.de",
    "airbnb.jp",
  ],
  BOOKING: ["booking.com"],
  AGODA: ["agoda.com"],
} as const satisfies Record<ReviewProviderType, readonly string[]>;

const AIRBNB_LISTING_PATH = /^\/rooms\/\d+\/?$/i;
const BOOKING_LISTING_PATH = /^\/hotel\/[a-z]{2}\/[^/]+\.html\/?$/i;

function isAgodaListingPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const hotelSegment = segments.findIndex((segment) => segment.toLowerCase() === "hotel");
  return hotelSegment > 0
    && hotelSegment === segments.length - 2
    && segments.at(-1)?.toLowerCase().endsWith(".html") === true;
}

export class ListingUrlError extends Error {
  constructor(
    public readonly provider: ReviewProviderType,
    public readonly code: "INVALID_URL" | "INVALID_PROTOCOL" | "INVALID_DOMAIN" | "INVALID_PATH",
  ) {
    const label = REVIEW_PROVIDER_CONFIG.find((item) => item.provider === provider)?.label ?? provider;
    super(`${label} 숙소 링크 형식이 올바르지 않습니다.`);
    this.name = "ListingUrlError";
  }
}

function configFor(provider: ReviewProviderType) {
  const config = REVIEW_PROVIDER_CONFIG.find((item) => item.provider === provider);
  if (!config) throw new ListingUrlError(provider, "INVALID_DOMAIN");
  return config;
}

export function isReviewProviderType(value: CalendarProviderType | string): value is ReviewProviderType {
  return REVIEW_PROVIDER_TYPES.includes(value as ReviewProviderType);
}

export function isAllowedListingHostname(provider: ReviewProviderType, hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return LISTING_PROVIDER_HOSTNAMES[provider].some((expected) => (
    normalized === expected || normalized.endsWith(`.${expected}`)
  ));
}

export function isAllowedListingPathname(provider: ReviewProviderType, pathname: string) {
  if (provider === "AIRBNB") return AIRBNB_LISTING_PATH.test(pathname);
  if (provider === "BOOKING") return BOOKING_LISTING_PATH.test(pathname);
  return isAgodaListingPath(pathname);
}

export function validateListingUrl(provider: ReviewProviderType, value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ListingUrlError(provider, "INVALID_URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new ListingUrlError(provider, "INVALID_PROTOCOL");
  }
  if (!isAllowedListingHostname(provider, url.hostname)) {
    throw new ListingUrlError(provider, "INVALID_DOMAIN");
  }
  if (!isAllowedListingPathname(provider, url.pathname)) {
    throw new ListingUrlError(provider, "INVALID_PATH");
  }
  return url;
}

const TRACKING_QUERY_KEYS = new Set(["aid", "label", "sid", "source", "source_impression_id"]);

export function normalizeListingUrl(provider: ReviewProviderType, value: string): string {
  const url = validateListingUrl(provider, value);
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function extractExternalListingId(provider: ReviewProviderType, value: string): string | null {
  const url = validateListingUrl(provider, value);
  if (provider === "AIRBNB") return url.pathname.match(/^\/rooms\/(\d+)\/?$/i)?.[1] ?? null;
  const queryId = url.searchParams.get("hotel_id") ?? url.searchParams.get("property_id");
  if (queryId?.trim()) return queryId.trim();
  if (provider === "AGODA") return url.pathname.match(/\/(?:hotel|property)\/([^/?#]+)/i)?.[1] ?? null;
  return null;
}

export function getReviewProviderLabel(provider: ReviewProviderType) {
  return configFor(provider).label;
}
