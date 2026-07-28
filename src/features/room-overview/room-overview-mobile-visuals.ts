import type { RoomOverviewCard } from "./domain/room-overview";

export type MobileRoomVisualStatus = "RESERVED" | "VACANT" | "CHECK_IN" | "CHECK_OUT" | "CLEANING" | "CONFLICT";

export const MOBILE_ROOM_STATUS_VISUALS = {
  RESERVED: { className: "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100" },
  VACANT: { className: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100" },
  CHECK_IN: { className: "border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100" },
  CHECK_OUT: { className: "border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100" },
  CLEANING: { className: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" },
  CONFLICT: { className: "border-red-400 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100" },
} as const satisfies Record<MobileRoomVisualStatus, { className: string }>;

export const MOBILE_TIMELINE_TODAY_VISUAL = {
  badgeClassName: "bg-blue-600 text-white dark:bg-blue-500 dark:text-white",
  lineClassName: "bg-blue-500/70 dark:bg-blue-400/70",
} as const;

export function getMobileRoomVisualStatus(room: RoomOverviewCard): MobileRoomVisualStatus {
  if (room.status === "CONFLICT") return "CONFLICT";
  if (room.operationalStatus === "CLEANING_REQUIRED") return "CLEANING";
  if (room.status === "CHECK_IN_TODAY") return "CHECK_IN";
  if (room.status === "CHECK_OUT_TODAY") return "CHECK_OUT";
  if (room.status === "OCCUPIED") return "RESERVED";
  return "VACANT";
}

export function getMobileRoomStatusVisual(room: RoomOverviewCard, translate: (key: string) => string) {
  const status = getMobileRoomVisualStatus(room);
  const translationStatus = status === "RESERVED" ? "OCCUPIED" : status === "CHECK_IN" ? "CHECK_IN_TODAY" : status === "CHECK_OUT" ? "CHECK_OUT_TODAY" : status;
  return { ...MOBILE_ROOM_STATUS_VISUALS[status], label: translate(`roomStatus.${translationStatus}`) };
}

export function formatMobileRoomDate(value: Date | null | undefined, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(value);
}

export function getMobileSyncLabel(room: RoomOverviewCard, translate: (key: string) => string) {
  const error = room.syncStates.find((sync) => sync.status === "FAILED" || sync.status === "TIMEOUT");
  if (error) return { label: translate(error.status === "TIMEOUT" ? "sync.delayed" : "sync.error"), error: true };
  if (room.latestSync?.status === "RUNNING") return { label: translate("sync.statuses.RUNNING"), error: false };
  if (room.latestSync?.status === "SUCCESS") return { label: translate("sync.normal"), error: false };
  return { label: translate(room.providers.length ? "sync.noHistory" : "sync.noConnection"), error: false };
}
