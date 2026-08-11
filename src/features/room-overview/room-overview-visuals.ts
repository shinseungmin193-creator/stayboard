import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BedDouble,
  BrushCleaning,
  House,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";
import type { RoomOverviewCard, RoomReservationState } from "./domain/room-overview";

export type RoomOverviewVisualStatus = RoomReservationState | Exclude<RoomOperationalStatus, "NONE">;

export type RoomStatusTheme = {
  labelKey: `roomStatus.${RoomOverviewVisualStatus}`;
  titleClass: string;
  headerClass: string;
  bodyClass: string;
  badgeClass: string;
  icon: LucideIcon;
};

export const ROOM_STATUS_THEME = {
  VACANT: {
    labelKey: "roomStatus.VACANT",
    titleClass: "text-blue-950 dark:text-blue-50",
    headerClass: "bg-blue-600 text-white dark:bg-blue-700 dark:text-blue-50",
    bodyClass: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40",
    badgeClass: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200",
    icon: House,
  },
  CHECK_IN_TODAY: {
    labelKey: "roomStatus.CHECK_IN_TODAY",
    titleClass: "text-green-950 dark:text-green-50",
    headerClass: "bg-green-600 text-white dark:bg-green-700 dark:text-green-50",
    bodyClass: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
    badgeClass: "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200",
    icon: ArrowDownToLine,
  },
  CHECK_OUT_TODAY: {
    labelKey: "roomStatus.CHECK_OUT_TODAY",
    titleClass: "text-orange-950 dark:text-orange-50",
    headerClass: "bg-orange-600 text-white dark:bg-orange-700 dark:text-orange-50",
    bodyClass: "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40",
    badgeClass: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200",
    icon: ArrowUpFromLine,
  },
  OCCUPIED: {
    labelKey: "roomStatus.OCCUPIED",
    titleClass: "text-purple-950 dark:text-purple-50",
    headerClass: "bg-purple-600 text-white dark:bg-purple-700 dark:text-purple-50",
    bodyClass: "border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/40",
    badgeClass: "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200",
    icon: BedDouble,
  },
  CONFLICT: {
    labelKey: "roomStatus.CONFLICT",
    titleClass: "text-red-950 dark:text-red-50",
    headerClass: "bg-red-600 text-white dark:bg-red-700 dark:text-red-50",
    bodyClass: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
    badgeClass: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
    icon: AlertTriangle,
  },
  INSPECTION_REQUIRED: {
    labelKey: "roomStatus.INSPECTION_REQUIRED",
    titleClass: "text-gray-950 dark:text-gray-50",
    headerClass: "bg-gray-700 text-white dark:bg-gray-700 dark:text-gray-50",
    bodyClass: "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60",
    badgeClass: "border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
    icon: Wrench,
  },
  CLEANING_REQUIRED: {
    labelKey: "roomStatus.CLEANING_REQUIRED",
    titleClass: "text-amber-950 dark:text-amber-50",
    headerClass: "bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50",
    bodyClass: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    badgeClass: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
    icon: BrushCleaning,
  },
} as const satisfies Record<RoomOverviewVisualStatus, RoomStatusTheme>;

const OPERATIONAL_STATUS_THEME = {
  NONE: null,
  CLEANING_REQUIRED: "CLEANING_REQUIRED",
  INSPECTION_REQUIRED: "INSPECTION_REQUIRED",
} as const satisfies Record<RoomOperationalStatus, Exclude<RoomOverviewVisualStatus, RoomReservationState> | null>;

export function getRoomStatusThemeStatus(
  room: Pick<RoomOverviewCard, "status" | "operationalStatus">,
): RoomOverviewVisualStatus {
  if (room.status === "CONFLICT") return "CONFLICT";
  return OPERATIONAL_STATUS_THEME[room.operationalStatus] ?? room.status;
}
