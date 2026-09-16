"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requirePermission } from "@/features/access-control";
import { logServerError } from "@/lib/prisma-errors";
import { REVIEW_PROVIDER_TYPES } from "./domain/listing-provider";
import { REVIEW_SYNC_MAX_LISTINGS_PER_REQUEST } from "./review.constants";
import { findReviewSyncTarget, findReviewSyncTargets } from "./server/review.repository";
import { collectReviewListings, collectReviews } from "./server/review-sync.service";

const collectListingsSchema = z.object({
  listingIds: z.array(z.string().trim().min(1)).min(1).max(REVIEW_SYNC_MAX_LISTINGS_PER_REQUEST),
});

const collectSchema = z.object({
  roomId: z.string().trim().min(1).max(100),
  provider: z.enum(REVIEW_PROVIDER_TYPES),
});

export type ReviewCollectActionResult = {
  success: boolean;
  message: string;
  successCount?: number;
  failureCount?: number;
  alreadyRunningCount?: number;
};

export async function collectReviewsAction(input: unknown): Promise<ReviewCollectActionResult> {
  const parsed = collectSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "불러올 객실과 플랫폼을 확인해 주세요." };
  try {
    const context = await requirePermission(PERMISSIONS.PROPERTY_REVIEW_SYNC);
    const target = await findReviewSyncTarget(context, parsed.data);
    if (!target) return { success: false, message: "등록된 숙소 링크를 찾을 수 없습니다." };
    const result = await collectReviews({ target, actorUserId: context.userId });
    revalidatePath("/property-reviews");
    revalidatePath(`/property-reviews/${target.roomId}`);
    return {
      success: result.success,
      message: result.message,
      successCount: result.success ? 1 : 0,
      failureCount: !result.success && !result.alreadyRunning ? 1 : 0,
      alreadyRunningCount: result.alreadyRunning ? 1 : 0,
    };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    logServerError("collectReviews", error);
    return { success: false, message: "리뷰 정보를 불러오지 못했습니다." };
  }
}

export async function collectReviewListingsAction(input: unknown): Promise<ReviewCollectActionResult> {
  const parsed = collectListingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "갱신할 숙소 링크를 확인해 주세요." };
  try {
    const context = await requirePermission(PERMISSIONS.PROPERTY_REVIEW_SYNC);
    const targets = await findReviewSyncTargets(context, parsed.data.listingIds);
    if (!targets.length) return { success: false, message: "갱신할 수 있는 숙소 링크가 없습니다." };
    const result = await collectReviewListings(targets, context.userId);
    revalidatePath("/property-reviews");
    for (const roomId of new Set(targets.map((target) => target.roomId))) revalidatePath(`/property-reviews/${roomId}`);
    return {
      success: result.failureCount === 0,
      message: `현재 목록 리뷰 갱신: 성공 ${result.successCount}개 · 실패 ${result.failureCount}개 · 진행 중 ${result.alreadyRunningCount}개`,
      successCount: result.successCount,
      failureCount: result.failureCount,
      alreadyRunningCount: result.alreadyRunningCount,
    };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    logServerError("collectReviewListings", error);
    return { success: false, message: "현재 목록의 리뷰를 갱신하지 못했습니다." };
  }
}
