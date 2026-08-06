function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function getCleaningPhotoConfig() {
  return {
    maxBytes: positiveInteger("CLEANING_PHOTO_MAX_BYTES", 10 * 1024 * 1024),
    maxCount: positiveInteger("CLEANING_PHOTO_MAX_COUNT", 10),
    retentionDays: positiveInteger("CLEANING_PHOTO_RETENTION_DAYS", 7),
  } as const;
}
