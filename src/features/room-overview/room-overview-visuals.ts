import type { CSSProperties } from "react";
import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";
import type { RoomReservationState } from "./domain/room-overview";

export type RoomOverviewVisualStatus = RoomReservationState | Exclude<RoomOperationalStatus, "NONE">;

export type RoomStatusVisual = {
  label: string;
  strong: string;
  medium: string;
  soft: string;
  rgb: string;
  foreground: string;
};

export const ROOM_OVERVIEW_STATUS_VISUALS = {
  VACANT: { label: "공실", strong: "#2563eb", medium: "#1d4ed8", soft: "rgb(37 99 235 / 0.68)", rgb: "37 99 235", foreground: "#ffffff" },
  OCCUPIED: { label: "투숙 중", strong: "#f59e0b", medium: "#d97706", soft: "rgb(245 158 11 / 0.68)", rgb: "245 158 11", foreground: "#1c1917" },
  CHECK_IN_TODAY: { label: "오늘 체크인", strong: "#22c55e", medium: "#16a34a", soft: "rgb(34 197 94 / 0.68)", rgb: "34 197 94", foreground: "#052e16" },
  CHECK_OUT_TODAY: { label: "오늘 체크아웃", strong: "#f97316", medium: "#ea580c", soft: "rgb(249 115 22 / 0.7)", rgb: "249 115 22", foreground: "#1c1917" },
  CLEANING_REQUIRED: { label: "청소 필요", strong: "#14b8a6", medium: "#0d9488", soft: "rgb(20 184 166 / 0.68)", rgb: "20 184 166", foreground: "#042f2e" },
  INSPECTION_REQUIRED: { label: "점검 필요", strong: "#8b5cf6", medium: "#7c3aed", soft: "rgb(139 92 246 / 0.7)", rgb: "139 92 246", foreground: "#ffffff" },
  CONFLICT: { label: "오버부킹", strong: "#ef4444", medium: "#dc2626", soft: "rgb(239 68 68 / 0.72)", rgb: "239 68 68", foreground: "#ffffff" },
} satisfies Record<RoomOverviewVisualStatus, RoomStatusVisual>;

export type RoomStatusVisualProperties = CSSProperties & {
  "--room-status-strong": string;
  "--room-status-medium": string;
  "--room-status-soft": string;
  "--room-status-rgb": string;
  "--room-status-foreground": string;
};

export function getRoomOverviewStatusVisual(status: RoomOverviewVisualStatus): RoomStatusVisual {
  return ROOM_OVERVIEW_STATUS_VISUALS[status];
}

export function getRoomOverviewStatusStyle(status: RoomOverviewVisualStatus): RoomStatusVisualProperties {
  const visual = getRoomOverviewStatusVisual(status);
  return {
    "--room-status-strong": visual.strong,
    "--room-status-medium": visual.medium,
    "--room-status-soft": visual.soft,
    "--room-status-rgb": visual.rgb,
    "--room-status-foreground": visual.foreground,
  };
}
