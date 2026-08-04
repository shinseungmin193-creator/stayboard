export const CALENDAR_SOURCE_DELETE_CONFIRMATION_KEYWORDS = ["삭제", "削除"] as const;

export function isCalendarSourceDeleteConfirmationValid(
  confirmationText: string,
  sourceName: string,
): boolean {
  const confirmation = confirmationText.trim();
  return confirmation === sourceName.trim()
    || CALENDAR_SOURCE_DELETE_CONFIRMATION_KEYWORDS.some((keyword) => confirmation === keyword);
}

export function isCalendarSourceSyncRunning(
  startedAt: Date | null,
  now: Date,
  staleAfterMs: number,
): boolean {
  return Boolean(startedAt && startedAt.getTime() >= now.getTime() - staleAfterMs);
}
