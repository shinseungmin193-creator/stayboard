import "server-only";

import {
  calendarRoomSyncLockKey,
  calendarSourceSyncLockKey,
} from "@/features/calendar-sync/infrastructure/calendar-sync-lock";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { reviewSyncLockKey } from "@/features/reviews/server/review-sync-lock";
import { mapWithConcurrency } from "@/lib/concurrency";
import { logServerError } from "@/lib/prisma-errors";

export function roomRelatedOperationLockKeys(input: {
  scopeKey: string;
  roomIds: readonly string[];
  calendarSourceIds: readonly string[];
  roomListingIds: readonly string[];
}) {
  return [...new Set([
    input.scopeKey,
    ...input.calendarSourceIds.map(calendarSourceSyncLockKey),
    ...input.roomIds.map(calendarRoomSyncLockKey),
    ...input.roomListingIds.map(reviewSyncLockKey),
  ])];
}

export async function deleteCleaningPhotoFiles(storageKeys: readonly string[]) {
  const storage = getCleaningPhotoStorage();
  const outcomes = await mapWithConcurrency(storageKeys, 4, async (storageKey) => {
    try {
      await storage.delete(storageKey);
      return true;
    } catch (error) {
      logServerError("roomRelatedData.deleteCleaningPhotoFile", error);
      return false;
    }
  });
  return outcomes.filter((deleted) => !deleted).length;
}

