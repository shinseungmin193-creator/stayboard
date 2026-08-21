import { conflictPairKey, type ReservationConflictPair } from "./reservation-conflict";

export interface ExistingConflict extends ReservationConflictPair { id: string; status: "ACTIVE" | "RESOLVED" | "DISMISSED" }
export interface ConflictClassification { create: ReservationConflictPair[]; refresh: Array<{ id: string; pair: ReservationConflictPair; reactivate: boolean; overlapChanged: boolean }>; resolveIds: string[] }

export function classifyConflicts(
  existing: ExistingConflict[],
  detected: ReservationConflictPair[],
  options: { dismissedReactivationBoundary?: Date } = {},
): ConflictClassification {
  const current = new Map(existing.map((conflict) => [conflictPairKey(conflict.reservationAId, conflict.reservationBId), conflict]));
  const detectedKeys = new Set<string>();
  const result: ConflictClassification = { create: [], refresh: [], resolveIds: [] };
  for (const pair of detected) {
    const key = conflictPairKey(pair.reservationAId, pair.reservationBId);
    if (detectedKeys.has(key)) continue;
    detectedKeys.add(key);
    const previous = current.get(key);
    if (!previous) result.create.push(pair);
    else {
      const keepDismissed = previous.status === "DISMISSED"
        && (!options.dismissedReactivationBoundary || pair.overlapEnd < options.dismissedReactivationBoundary);
      if (!keepDismissed) result.refresh.push({ id: previous.id, pair, reactivate: previous.status !== "ACTIVE", overlapChanged: previous.overlapStart.getTime() !== pair.overlapStart.getTime() || previous.overlapEnd.getTime() !== pair.overlapEnd.getTime() });
    }
  }
  for (const conflict of existing) if (conflict.status === "ACTIVE" && !detectedKeys.has(conflictPairKey(conflict.reservationAId, conflict.reservationBId))) result.resolveIds.push(conflict.id);
  return result;
}
