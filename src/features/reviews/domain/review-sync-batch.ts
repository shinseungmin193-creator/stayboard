import { mapWithConcurrency } from "../../../lib/concurrency";

export async function runIsolatedReviewSyncBatch<T, R>(input: {
  targets: readonly T[];
  concurrency: number;
  worker: (target: T) => Promise<R>;
  failure: (target: T, error: unknown) => R;
}) {
  return mapWithConcurrency([...input.targets], input.concurrency, async (target) => {
    try { return await input.worker(target); }
    catch (error) { return input.failure(target, error); }
  });
}
