export type CleaningTimeStatus =
  | { kind: "none" }
  | { kind: "completed" }
  | { kind: "remaining" | "delayed"; hours: number; minutes: number };

export function getCleaningTimeStatus(input: {
  targetAt: Date | null;
  referenceAt: Date;
  completedAt?: Date | null;
}): CleaningTimeStatus {
  if (input.completedAt) return { kind: "completed" };
  if (!input.targetAt || !Number.isFinite(input.targetAt.getTime()) || !Number.isFinite(input.referenceAt.getTime())) {
    return { kind: "none" };
  }
  const differenceMinutes = Math.trunc((input.targetAt.getTime() - input.referenceAt.getTime()) / 60_000);
  const absoluteMinutes = Math.abs(differenceMinutes);
  return {
    kind: differenceMinutes >= 0 ? "remaining" : "delayed",
    hours: Math.floor(absoluteMinutes / 60),
    minutes: absoluteMinutes % 60,
  };
}
