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

type CleaningWorkerListItem = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  isActive: boolean;
};

export function upsertCleaningWorkerList<T extends CleaningWorkerListItem>(
  workers: readonly T[],
  worker: T,
): T[] {
  const next = workers.some((item) => item.id === worker.id)
    ? workers.map((item) => item.id === worker.id ? worker : item)
    : [...workers, worker];

  return next.sort((left, right) => (
    left.companyName.localeCompare(right.companyName, "ko")
    || Number(right.isActive) - Number(left.isActive)
    || left.name.localeCompare(right.name, "ko")
    || left.id.localeCompare(right.id)
  ));
}

export function getSelectableCleaningWorkers<T extends CleaningWorkerListItem>(
  workers: readonly T[],
  companyId: string,
): T[] {
  return workers
    .filter((worker) => worker.companyId === companyId && worker.isActive)
    .sort((left, right) => left.name.localeCompare(right.name, "ko") || left.id.localeCompare(right.id));
}
