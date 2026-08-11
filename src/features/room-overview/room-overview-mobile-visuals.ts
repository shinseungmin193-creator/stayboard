import type { RoomOverviewCard } from "./domain/room-overview";
import { getRoomStatusThemeStatus, ROOM_STATUS_THEME } from "./room-overview-visuals";

export const MOBILE_TIMELINE_TODAY_VISUAL = {
  badgeClassName: "bg-blue-600 text-white dark:bg-blue-500 dark:text-white",
  lineClassName: "bg-blue-500/70 dark:bg-blue-400/70",
} as const;

export function getMobileRoomStatusVisual(room: RoomOverviewCard, translate: (key: string) => string) {
  const status = getRoomStatusThemeStatus(room);
  const theme = ROOM_STATUS_THEME[status];
  return { status, ...theme, label: translate(theme.labelKey) };
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
