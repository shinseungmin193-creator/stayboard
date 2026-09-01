import "server-only";

import { hasPermission, PERMISSIONS, PermissionDeniedError, roomScopeWhere, type AccessContext } from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import type { ReviewProviderType } from "../domain/listing-provider";
import type { ReviewListingSummary, ReviewRoomDetail, ReviewRoomPage, ReviewSyncTarget } from "../review.types";

export const REVIEW_LIST_PAGE_SIZE = 30;

function assertRead(context: AccessContext) {
  if (!hasPermission(context.role, PERMISSIONS.PROPERTY_REVIEW_READ)) throw new PermissionDeniedError();
}

function assertSync(context: AccessContext) {
  if (!hasPermission(context.role, PERMISSIONS.PROPERTY_REVIEW_SYNC)) throw new PermissionDeniedError();
}

function summaryFor(listing: {
  id: string;
  provider: string;
  listingUrl: string;
  reviewSnapshots: Array<{ sourceListingUrl: string; rating: { toString(): string } | null; reviewCount: number | null; collectedAt: Date }>;
  syncLogs: Array<{ sourceListingUrl: string; status: "RUNNING" | "SUCCESS" | "FAILED" | "TIMEOUT"; errorCode: string | null; errorMessage: string | null; startedAt: Date; finishedAt: Date | null }>;
}): ReviewListingSummary {
  const snapshot = listing.reviewSnapshots.find((item) => item.sourceListingUrl === listing.listingUrl);
  const syncLog = listing.syncLogs.find((item) => item.sourceListingUrl === listing.listingUrl);
  return {
    id: listing.id,
    provider: listing.provider as ReviewProviderType,
    rating: snapshot?.rating?.toString() ?? null,
    reviewCount: snapshot?.reviewCount ?? null,
    collectedAt: snapshot?.collectedAt ?? null,
    latestSyncStatus: syncLog?.status ?? null,
    latestSyncErrorCode: syncLog?.errorCode ?? null,
    latestSyncErrorMessage: syncLog?.errorMessage ?? null,
    latestSyncStartedAt: syncLog?.startedAt ?? null,
    latestSyncFinishedAt: syncLog?.finishedAt ?? null,
  };
}

export async function listReviewRooms(context: AccessContext, input: {
  propertyId?: string;
  query?: string;
  page?: number;
}): Promise<ReviewRoomPage> {
  assertRead(context);
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const query = input.query?.trim();
  const scope = roomScopeWhere(context.scope);
  const where = {
    AND: [
      scope ?? {},
      { isActive: true, property: { isActive: true } },
      input.propertyId ? { propertyId: input.propertyId } : {},
      query ? { OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { property: { name: { contains: query, mode: "insensitive" as const } } },
      ] } : {},
    ],
  };
  const [totalCount, rooms] = await Promise.all([
    prisma.room.count({ where }),
    prisma.room.findMany({
      where,
      skip: (page - 1) * REVIEW_LIST_PAGE_SIZE,
      take: REVIEW_LIST_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        propertyId: true,
        property: { select: { name: true } },
        listings: {
          where: { isActive: true, provider: { in: ["AIRBNB", "BOOKING", "AGODA"] } },
          select: {
            id: true,
            provider: true,
            listingUrl: true,
            reviewSnapshots: { orderBy: { collectedAt: "desc" }, take: 10, select: { sourceListingUrl: true, rating: true, reviewCount: true, collectedAt: true } },
            syncLogs: { orderBy: { startedAt: "desc" }, take: 10, select: { sourceListingUrl: true, status: true, errorCode: true, errorMessage: true, startedAt: true, finishedAt: true } },
          },
          orderBy: { provider: "asc" },
        },
      },
      orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      propertyId: room.propertyId,
      propertyName: room.property.name,
      listings: room.listings.map(summaryFor),
    })),
    totalCount,
    page,
    pageSize: REVIEW_LIST_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(totalCount / REVIEW_LIST_PAGE_SIZE)),
  };
}

export async function getReviewRoomDetail(context: AccessContext, roomId: string): Promise<ReviewRoomDetail | null> {
  assertRead(context);
  const room = await prisma.room.findFirst({
    where: { AND: [{ id: roomId }, roomScopeWhere(context.scope) ?? {}] },
    select: {
      id: true,
      name: true,
      property: { select: { name: true } },
      listings: {
        where: { isActive: true, provider: { in: ["AIRBNB", "BOOKING", "AGODA"] } },
        select: {
          id: true,
          provider: true,
          listingUrl: true,
          reviewSnapshots: { orderBy: { collectedAt: "desc" }, take: 10, select: { sourceListingUrl: true, rating: true, reviewCount: true, collectedAt: true } },
          syncLogs: { orderBy: { startedAt: "desc" }, take: 10, select: { sourceListingUrl: true, status: true, errorCode: true, errorMessage: true, startedAt: true, finishedAt: true } },
        },
        orderBy: { provider: "asc" },
      },
    },
  });
  if (!room) return null;
  const listings = await Promise.all(room.listings.map(async (listing) => ({
    ...summaryFor(listing),
    reviews: (await prisma.listingReview.findMany({
      where: { roomListingId: listing.id, sourceListingUrl: listing.listingUrl },
      select: { id: true, reviewerName: true, rating: true, content: true, reviewedAt: true, collectedAt: true },
      orderBy: [{ reviewedAt: "desc" }, { collectedAt: "desc" }, { id: "asc" }],
      take: 100,
    })).map((review) => ({ ...review, rating: review.rating?.toString() ?? null })),
  })));
  return { id: room.id, name: room.name, propertyName: room.property.name, listings };
}

export async function findReviewSyncTargets(context: AccessContext, listingIds: readonly string[]): Promise<ReviewSyncTarget[]> {
  assertSync(context);
  if (!listingIds.length) return [];
  const listings = await prisma.roomListing.findMany({
    where: {
      id: { in: [...new Set(listingIds)] },
      isActive: true,
      provider: { in: ["AIRBNB", "BOOKING", "AGODA"] },
      room: { AND: [roomScopeWhere(context.scope) ?? {}, { isActive: true, property: { isActive: true } }] },
    },
    select: { id: true, roomId: true, provider: true, listingUrl: true },
    orderBy: [{ roomId: "asc" }, { provider: "asc" }],
  });
  return listings.map((listing) => ({ ...listing, provider: listing.provider as ReviewProviderType }));
}
