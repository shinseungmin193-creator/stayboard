"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requirePermission } from "@/features/access-control";
import { logServerError } from "@/lib/prisma-errors";
import { REVIEW_SYNC_MAX_LISTINGS_PER_REQUEST } from "./review.constants";
import { findReviewSyncTargets } from "./server/review.repository";
import { syncReviewListings } from "./server/review-sync.service";

const refreshSchema = z.object({
  listingIds: z.array(z.string().trim().min(1)).min(1).max(REVIEW_SYNC_MAX_LISTINGS_PER_REQUEST),
});

export type ReviewRefreshActionResult = {
  success: boolean;
  message: string;
  successCount?: number;
  failureCount?: number;
  alreadyRunningCount?: number;
};

export async function refreshReviewsAction(input: unknown): Promise<ReviewRefreshActionResult> {
  const parsed = refreshSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "새로고침할 숙소 링크를 확인해 주세요." };
  try {
    const context = await requirePermission(PERMISSIONS.PROPERTY_REVIEW_SYNC);
    const targets = await findReviewSyncTargets(context, parsed.data.listingIds);
    if (!targets.length) return { success: false, message: "새로고침할 수 있는 숙소 링크가 없습니다." };
    const result = await syncReviewListings(targets, context.userId);
    revalidatePath("/property-reviews");
    for (const roomId of new Set(targets.map((target) => target.roomId))) revalidatePath(`/property-reviews/${roomId}`);
    return {
      success: result.failureCount === 0,
      message: `리뷰 새로고침: 성공 ${result.successCount}개 · 실패 ${result.failureCount}개 · 진행 중 ${result.alreadyRunningCount}개`,
      successCount: result.successCount,
      failureCount: result.failureCount,
      alreadyRunningCount: result.alreadyRunningCount,
    };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    logServerError("refreshReviews", error);
    return { success: false, message: "리뷰를 새로고침하지 못했습니다." };
  }
}
