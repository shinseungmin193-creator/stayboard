export const RESERVATION_CONFLICT_UI = {
  label: "오버부킹",
  detectionLabel: "오버부킹 감지",
  listLabel: "오버부킹 목록",
  countLabel: "오버부킹 건수",
  occurredLabel: "오버부킹 발생",
  noneLabel: "오버부킹 없음",
  activeLabel: "ACTIVE 오버부킹",
  activeNoneMessage: "활성 오버부킹이 없습니다.",
  emptyTitle: "조건에 맞는 오버부킹이 없습니다",
  eyebrow: "OVERBOOKING",
} as const;

export function formatReservationConflictCount(count: number) {
  return `${RESERVATION_CONFLICT_UI.label} ${count}건`;
}
