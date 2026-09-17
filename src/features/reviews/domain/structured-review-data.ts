import type { CollectedListingReview, ReviewCollectionResult } from "./review-data";
import { extractExternalListingId, type ReviewProviderType } from "./listing-provider";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 10_000) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

function decimal(value: unknown): string | null {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const normalized = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? normalized : null;
}

function count(value: unknown): number | null {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function date(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function types(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? [value] : [];
}

function visit(value: unknown, records: JsonRecord[]) {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, records);
    return;
  }
  if (!isRecord(value)) return;
  records.push(value);
  for (const child of Object.values(value)) visit(child, records);
}

function reviewFromRecord(record: JsonRecord): CollectedListingReview | null {
  if (!types(record["@type"]).some((type) => type.toLowerCase() === "review")) return null;
  const author = isRecord(record.author) ? record.author : null;
  const rating = isRecord(record.reviewRating) ? record.reviewRating : null;
  const review: CollectedListingReview = {
    providerReviewId: text(record["@id"] ?? record.identifier, 500),
    reviewerName: text(author?.name ?? record.author, 300),
    rating: decimal(rating?.ratingValue ?? record.ratingValue),
    content: text(record.reviewBody ?? record.description),
    reviewedAt: date(record.datePublished ?? record.dateCreated),
  };
  return review.content || review.rating || review.reviewedAt ? review : null;
}

export function extractJsonLdDocuments(html: string): unknown[] {
  const documents: unknown[] = [];
  const pattern = /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json(?:\s*;[^"']*)?["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    const source = match[1]?.trim().replace(/^<!--|-->$/g, "").trim();
    if (!source) continue;
    try { documents.push(JSON.parse(source)); } catch { /* Ignore only the malformed block; another valid JSON-LD block may exist. */ }
  }
  return documents;
}

export function parseStructuredReviewData(html: string, collectedAt = new Date()): ReviewCollectionResult | null {
  const records: JsonRecord[] = [];
  for (const document of extractJsonLdDocuments(html)) visit(document, records);

  let rating: string | null = null;
  let reviewCount: number | null = null;
  for (const record of records) {
    if (!isRecord(record.aggregateRating)) continue;
    const candidateRating = decimal(record.aggregateRating.ratingValue);
    const candidateCount = count(record.aggregateRating.reviewCount ?? record.aggregateRating.ratingCount);
    if (candidateRating !== null || candidateCount !== null) {
      rating = candidateRating;
      reviewCount = candidateCount;
      break;
    }
  }
  const reviews = records.map(reviewFromRecord).filter((review): review is CollectedListingReview => Boolean(review));
  const resolvedReviewCount = reviewCount ?? (reviews.length > 0 ? reviews.length : null);
  if (resolvedReviewCount === null) return null;
  return {
    rating: resolvedReviewCount === 0 && reviews.length === 0 ? null : rating,
    reviewCount: resolvedReviewCount,
    reviews,
    collectedAt,
  };
}

const LISTING_SCHEMA_TYPES: Record<ReviewProviderType, ReadonlySet<string>> = {
  AIRBNB: new Set(["vacationrental"]),
  BOOKING: new Set(["hotel", "lodgingbusiness", "accommodation", "apartment", "hostel", "product"]),
  AGODA: new Set(["hotel", "lodgingbusiness", "accommodation", "resort", "apartment", "product"]),
};

function scalar(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function matchesListingIdentifier(value: unknown, expectedListingId: string) {
  const identifier = scalar(value);
  if (!identifier) return false;
  if (identifier === expectedListingId) return true;
  try {
    const decoded = atob(identifier);
    return decoded.split(":").at(-1) === expectedListingId;
  } catch {
    return false;
  }
}

function hasConfirmedListingIdentity(provider: ReviewProviderType, listingUrl: string, records: JsonRecord[]) {
  const expectedListingId = provider === "AIRBNB" ? extractExternalListingId(provider, listingUrl) : null;
  return records.some((record) => {
    const recognizedType = types(record["@type"]).some((type) => LISTING_SCHEMA_TYPES[provider].has(type.toLowerCase()));
    if (!recognizedType || text(record.name, 500) === null) return false;
    if (provider !== "AIRBNB") return true;
    return expectedListingId !== null && matchesListingIdentifier(record.identifier, expectedListingId);
  });
}

function hasExplicitZeroReviewSignal(provider: ReviewProviderType, html: string) {
  const fieldNames = provider === "AIRBNB"
    ? ["reviewCount"]
    : ["reviewCount", "review_count", "ratingCount"];
  const fieldSignal = fieldNames.some((field) => new RegExp(
    `["']${field}["']\\s*:\\s*(?:["']0["']|0)(?=\\s*[,}])`,
    "i",
  ).test(html));
  if (fieldSignal) return true;
  return /\b(?:no reviews yet|no guest reviews|be the first to review)\b|(?:리뷰|후기)가 없습니다|レビューはまだありません/i.test(html);
}

/**
 * Parses public review data and recognizes an empty result only when the page
 * proves both a real provider listing identity and an explicit zero-review signal.
 */
export function parseProviderReviewPage(input: {
  provider: ReviewProviderType;
  listingUrl: string;
  html: string;
  collectedAt?: Date;
}): ReviewCollectionResult | null {
  const collectedAt = input.collectedAt ?? new Date();
  const structured = parseStructuredReviewData(input.html, collectedAt);
  if (structured) return structured;

  const records: JsonRecord[] = [];
  for (const document of extractJsonLdDocuments(input.html)) visit(document, records);
  if (!hasConfirmedListingIdentity(input.provider, input.listingUrl, records)) return null;
  if (!hasExplicitZeroReviewSignal(input.provider, input.html)) return null;
  return { rating: null, reviewCount: 0, reviews: [], collectedAt };
}
