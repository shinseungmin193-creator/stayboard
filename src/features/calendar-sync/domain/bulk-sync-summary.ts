export type BulkSyncOutcome = "SUCCESS" | "FAILED" | "SKIPPED";

export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const normalizedSize = Math.max(1, Math.trunc(size) || 1);
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += normalizedSize) batches.push(items.slice(index, index + normalizedSize));
  return batches;
}

export function summarizeBulkSync(input: { targetRoomIds: readonly string[]; sources: readonly { roomId: string }[]; outcomes: readonly BulkSyncOutcome[] }) {
  const targetRoomIds = new Set(input.targetRoomIds);
  const roomsWithActiveSources = new Set(input.sources.map((source) => source.roomId));
  return {
    targetRoomCount: targetRoomIds.size,
    activeSourceCount: input.sources.length,
    roomsWithoutActiveSources: [...targetRoomIds].filter((roomId) => !roomsWithActiveSources.has(roomId)).length,
    successCount: input.outcomes.filter((outcome) => outcome === "SUCCESS").length,
    failureCount: input.outcomes.filter((outcome) => outcome === "FAILED").length,
    skippedCount: input.outcomes.filter((outcome) => outcome === "SKIPPED").length,
  };
}
