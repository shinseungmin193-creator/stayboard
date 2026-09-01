import type { CollectedListingReview, ReviewCollectionResult } from "./review-data";

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
  if (rating === null && reviewCount === null && reviews.length === 0) return null;
  return { rating, reviewCount, reviews, collectedAt };
}
