export const CLEANING_WORKER_NAME_MAX_LENGTH = 30;

export class CleaningWorkerNameError extends Error {
  constructor() {
    super("INVALID_CLEANING_WORKER_NAME");
    this.name = "CleaningWorkerNameError";
  }
}

export function normalizeCleaningWorkerDisplayName(value: string | null | undefined): string {
  const normalized = value?.normalize("NFKC").trim().replace(/\s+/g, " ") ?? "";
  if (!normalized || normalized.length > CLEANING_WORKER_NAME_MAX_LENGTH) {
    throw new CleaningWorkerNameError();
  }
  return normalized;
}

export function getCleaningWorkerNormalizedName(value: string): string {
  return normalizeCleaningWorkerDisplayName(value).toLocaleLowerCase("en-US");
}
