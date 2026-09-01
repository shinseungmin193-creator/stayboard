import "server-only";

import { AdvisoryLockUnavailableError, withPostgresAdvisoryLocks } from "@/lib/postgres-advisory-lock";
import { prisma } from "@/lib/prisma";
import { createReviewFingerprint, shouldCreateReviewSnapshot } from "../domain/review-data";
import { runIsolatedReviewSyncBatch } from "../domain/review-sync-batch";
import { getReviewProvider } from "../providers/review-provider-registry";
import { ReviewFetchError } from "../providers/review-page-fetcher";
import { REVIEW_SYNC_CONCURRENCY, REVIEW_SYNC_MAX_REVIEWS_PER_LISTING, REVIEW_SYNC_STALE_RUNNING_MS } from "../review.constants";
import type { ReviewSyncTarget } from "../review.types";

export interface ReviewSyncResult {
  listingId: string;
  provider: ReviewSyncTarget["provider"];
  success: boolean;
  alreadyRunning: boolean;
  fetchedReviewCount: number;
  newReviewCount: number;
  message: string;
}

const lockKey = (listingId: string) => `room-listing-review:${listingId}`;
const safeErrorMessage = (message: string) => message.replace(/https?:\/\/\S+/gi, "[URL 숨김]").replace(/[\r\n]+/g, " ").slice(0, 300);

function errorDetails(provider: ReviewSyncTarget["provider"], error: unknown) {
  if (error instanceof ReviewFetchError) {
    return { code: `${provider}_REVIEW_${error.code}`, message: safeErrorMessage(error.message) };
  }
  if (error instanceof Error && error.message === "ROOM_LISTING_CHANGED") {
    return { code: "ROOM_LISTING_CHANGED", message: "수집 중 숙소 링크가 변경되어 결과를 저장하지 않았습니다." };
  }
  return { code: `${provider}_REVIEW_FETCH_FAILED`, message: "리뷰 수집 중 안전하게 처리할 수 없는 오류가 발생했습니다." };
}

async function failLog(logId: string, provider: ReviewSyncTarget["provider"], error: unknown) {
  const details = errorDetails(provider, error);
  await prisma.reviewSyncLog.updateMany({
    where: { id: logId, status: "RUNNING" },
    data: { status: "FAILED", finishedAt: new Date(), errorCode: details.code, errorMessage: details.message },
  });
  return details;
}

async function syncWithLock(target: ReviewSyncTarget, actorUserId: string): Promise<ReviewSyncResult> {
  const now = new Date();
  await prisma.reviewSyncLog.updateMany({
    where: {
      roomListingId: target.id,
      status: "RUNNING",
      startedAt: { lt: new Date(now.getTime() - REVIEW_SYNC_STALE_RUNNING_MS) },
    },
    data: { status: "TIMEOUT", finishedAt: now, errorCode: "REVIEW_SYNC_TIMEOUT", errorMessage: "이전 리뷰 수집 작업이 제한 시간을 초과했습니다." },
  });
  const current = await prisma.roomListing.findFirst({
    where: { id: target.id, roomId: target.roomId, provider: target.provider, listingUrl: target.listingUrl, isActive: true },
    select: { id: true },
  });
  if (!current) return { listingId: target.id, provider: target.provider, success: false, alreadyRunning: false, fetchedReviewCount: 0, newReviewCount: 0, message: "숙소 링크가 변경되었거나 비활성화되었습니다." };

  const log = await prisma.reviewSyncLog.create({
    data: {
      roomListingId: target.id,
      actorUserId,
      provider: target.provider,
      sourceListingUrl: target.listingUrl,
      status: "RUNNING",
      startedAt: now,
    },
    select: { id: true },
  });

  try {
    const collected = await getReviewProvider(target.provider).fetch({ listingUrl: target.listingUrl });
    const reviewsByFingerprint = new Map(collected.reviews.slice(0, REVIEW_SYNC_MAX_REVIEWS_PER_LISTING).map((review) => [
      createReviewFingerprint({ provider: target.provider, listingUrl: target.listingUrl, review }),
      review,
    ]));
    const fingerprints = [...reviewsByFingerprint.keys()];
    const existingFingerprints = fingerprints.length ? await prisma.listingReview.findMany({
      where: { roomListingId: target.id, fingerprint: { in: fingerprints } },
      select: { fingerprint: true },
    }) : [];
    const existingSet = new Set(existingFingerprints.map((item) => item.fingerprint));
    const newReviewCount = fingerprints.filter((fingerprint) => !existingSet.has(fingerprint)).length;

    await prisma.$transaction(async (tx) => {
      const unchangedListing = await tx.roomListing.findFirst({
        where: { id: target.id, roomId: target.roomId, provider: target.provider, listingUrl: target.listingUrl, isActive: true },
        select: { id: true },
      });
      if (!unchangedListing) throw new Error("ROOM_LISTING_CHANGED");

      const latestSnapshot = await tx.reviewSnapshot.findFirst({
        where: { roomListingId: target.id, sourceListingUrl: target.listingUrl },
        select: { rating: true, reviewCount: true },
        orderBy: { collectedAt: "desc" },
      });
      const incomingSnapshot = { rating: collected.rating, reviewCount: collected.reviewCount };
      if (shouldCreateReviewSnapshot(
        latestSnapshot ? { rating: latestSnapshot.rating?.toString() ?? null, reviewCount: latestSnapshot.reviewCount } : null,
        incomingSnapshot,
      )) {
        await tx.reviewSnapshot.create({
          data: {
            roomListingId: target.id,
            sourceListingUrl: target.listingUrl,
            rating: collected.rating,
            reviewCount: collected.reviewCount,
            collectedAt: collected.collectedAt,
          },
        });
      }

      for (const [fingerprint, review] of reviewsByFingerprint) {
        await tx.listingReview.upsert({
          where: { roomListingId_fingerprint: { roomListingId: target.id, fingerprint } },
          create: {
            roomListingId: target.id,
            sourceListingUrl: target.listingUrl,
            providerReviewId: review.providerReviewId,
            reviewerName: review.reviewerName,
            rating: review.rating,
            content: review.content,
            reviewedAt: review.reviewedAt,
            fingerprint,
            collectedAt: collected.collectedAt,
          },
          update: {
            sourceListingUrl: target.listingUrl,
            providerReviewId: review.providerReviewId,
            reviewerName: review.reviewerName,
            rating: review.rating,
            content: review.content,
            reviewedAt: review.reviewedAt,
            collectedAt: collected.collectedAt,
          },
        });
      }
      await tx.reviewSyncLog.update({
        where: { id: log.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          fetchedReviewCount: reviewsByFingerprint.size,
          newReviewCount,
          errorCode: null,
          errorMessage: null,
        },
      });
    });
    return {
      listingId: target.id,
      provider: target.provider,
      success: true,
      alreadyRunning: false,
      fetchedReviewCount: reviewsByFingerprint.size,
      newReviewCount,
      message: "리뷰 정보를 새로고침했습니다.",
    };
  } catch (error) {
    const details = await failLog(log.id, target.provider, error);
    return { listingId: target.id, provider: target.provider, success: false, alreadyRunning: false, fetchedReviewCount: 0, newReviewCount: 0, message: details.message };
  }
}

export async function syncReviewListing(target: ReviewSyncTarget, actorUserId: string): Promise<ReviewSyncResult> {
  try {
    return await withPostgresAdvisoryLocks([lockKey(target.id)], () => syncWithLock(target, actorUserId));
  } catch (error) {
    if (error instanceof AdvisoryLockUnavailableError) {
      return { listingId: target.id, provider: target.provider, success: false, alreadyRunning: true, fetchedReviewCount: 0, newReviewCount: 0, message: "이미 이 숙소 링크의 리뷰를 새로고침하고 있습니다." };
    }
    throw error;
  }
}

export async function syncReviewListings(targets: readonly ReviewSyncTarget[], actorUserId: string) {
  const results = await runIsolatedReviewSyncBatch({
    targets,
    concurrency: REVIEW_SYNC_CONCURRENCY,
    worker: (target) => syncReviewListing(target, actorUserId),
    failure: (target) => ({ listingId: target.id, provider: target.provider, success: false, alreadyRunning: false, fetchedReviewCount: 0, newReviewCount: 0, message: "리뷰 새로고침을 시작하지 못했습니다." } satisfies ReviewSyncResult),
  });
  return {
    results,
    successCount: results.filter((item) => item.success).length,
    failureCount: results.filter((item) => !item.success && !item.alreadyRunning).length,
    alreadyRunningCount: results.filter((item) => item.alreadyRunning).length,
  };
}
