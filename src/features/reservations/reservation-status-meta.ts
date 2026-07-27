import type { SyncStatus } from "@/lib/generated/prisma/enums";
import type { ReservationDisplayStatus } from "./reservation-display-status";

const RESERVATION_STATUS_META = {
  UPCOMING: { label: "예약", className: "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100" },
  STAYING: { label: "투숙 중", className: "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100" },
  CHECK_IN_TODAY: { label: "오늘 체크인", className: "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/70 dark:text-sky-100" },
  CHECK_OUT_TODAY: { label: "오늘 체크아웃", className: "border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-950/70 dark:text-violet-100" },
  PAST: { label: "지난 예약", className: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" },
  CANCELLED: { label: "취소됨", className: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200" },
} as const satisfies Record<ReservationDisplayStatus, { label: string; className: string }>;

const SYNC_STATUS_LABELS = {
  RUNNING: "동기화 중",
  SUCCESS: "정상",
  FAILED: "오류",
  TIMEOUT: "시간 초과",
} as const satisfies Record<SyncStatus, string>;

export function getReservationStatusLabel(status: ReservationDisplayStatus): string {
  return RESERVATION_STATUS_META[status].label;
}

export function getReservationStatusVariant(status: ReservationDisplayStatus): string {
  return RESERVATION_STATUS_META[status].className;
}

export function getReservationSyncStatusLabel(status: SyncStatus): string {
  return SYNC_STATUS_LABELS[status];
}
