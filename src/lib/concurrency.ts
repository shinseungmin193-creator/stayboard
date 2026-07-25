export async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length); let nextIndex = 0; let firstError: unknown;
  async function run() { while (true) { const index = nextIndex; nextIndex += 1; if (index >= items.length) return; try { results[index] = await worker(items[index]); } catch (error) { firstError ??= error; } } }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.trunc(concurrency) || 1), items.length) }, run));
  if (firstError) throw firstError;
  return results;
}
