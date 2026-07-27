import type { RoomOverviewCard } from "./domain/room-overview";

export type MobileRoomVisualStatus = "RESERVED" | "VACANT" | "CHECK_IN" | "CHECK_OUT" | "CLEANING" | "CONFLICT";

export const MOBILE_ROOM_STATUS_VISUALS = {
  RESERVED: { label: "예약", className: "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100" },
  VACANT: { label: "공실", className: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100" },
  CHECK_IN: { label: "체크인", className: "border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100" },
  CHECK_OUT: { label: "체크아웃", className: "border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100" },
  CLEANING: { label: "청소중", className: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" },
  CONFLICT: { label: "오버부킹", className: "border-red-400 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100" },
} as const satisfies Record<MobileRoomVisualStatus, { label: string; className: string }>;

export function getMobileRoomVisualStatus(room: RoomOverviewCard): MobileRoomVisualStatus {
  if (room.status === "CONFLICT") return "CONFLICT";
  if (room.operationalStatus === "CLEANING_REQUIRED") return "CLEANING";
  if (room.status === "CHECK_IN_TODAY") return "CHECK_IN";
  if (room.status === "CHECK_OUT_TODAY") return "CHECK_OUT";
  if (room.status === "OCCUPIED") return "RESERVED";
  return "VACANT";
}

export function getMobileRoomStatusVisual(room: RoomOverviewCard) {
  return MOBILE_ROOM_STATUS_VISUALS[getMobileRoomVisualStatus(room)];
}

export function formatMobileRoomDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(value);
}

export function getMobileSyncLabel(room: RoomOverviewCard) {
  const error = room.syncStates.find((sync) => sync.status === "FAILED" || sync.status === "TIMEOUT");
  if (error) return { label: error.status === "TIMEOUT" ? "동기화 지연" : "동기화 오류", error: true };
  if (room.latestSync?.status === "RUNNING") return { label: "동기화 중", error: false };
  if (room.latestSync?.status === "SUCCESS") return { label: "동기화 정상", error: false };
  return { label: room.providers.length ? "동기화 기록 없음" : "OTA 연결 없음", error: false };
}

