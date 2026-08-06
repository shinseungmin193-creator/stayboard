import { getCleaningPhotoConfig } from "../config/cleaning-photo-config";

export const CLEANING_PHOTO_RETENTION_DAYS = getCleaningPhotoConfig().retentionDays;
export const MIN_REQUIRED_CLEANING_PHOTOS = 1;
export const CLEANING_PHOTO_DELETE_BATCH_SIZE = 100;

export function getCleaningPhotoDeleteAfter(completedAt: Date) {
  return new Date(completedAt.getTime() + CLEANING_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
