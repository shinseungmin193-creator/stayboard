import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";

export const ROOM_OPERATIONAL_STATUS_VALUES = ["NONE", "CLEANING_REQUIRED", "INSPECTION_REQUIRED"] as const satisfies readonly RoomOperationalStatus[];
export const ROOM_OPERATIONAL_STATUS_META = {
  NONE: { labelKey: "roomStatus.NONE", badgeClassName: "" },
  CLEANING_REQUIRED: { labelKey: "roomStatus.CLEANING_REQUIRED", badgeClassName: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  INSPECTION_REQUIRED: { labelKey: "roomStatus.INSPECTION_REQUIRED", badgeClassName: "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200" },
} as const satisfies Record<RoomOperationalStatus, { labelKey: `roomStatus.${RoomOperationalStatus}`; badgeClassName: string }>;

export function getRoomOperationalStatusLabel(
  status: RoomOperationalStatus,
  translate: (key: `roomStatus.${RoomOperationalStatus}`) => string,
) {
  return translate(ROOM_OPERATIONAL_STATUS_META[status].labelKey);
}

export const ROOM_OPERATION_POLICY = { autoMarkCleaningRequired: false } as const;

export function shouldMarkCleaningRequired(input: { operationalStatus: RoomOperationalStatus; reservations: Array<{ status: string; startDate: Date; endDate: Date }>; todayStart: Date; todayEnd: Date }) {
  if (!ROOM_OPERATION_POLICY.autoMarkCleaningRequired || input.operationalStatus !== "NONE") return false;
  return input.reservations.some((item) => item.status !== "CANCELLED" && item.status !== "BLOCKED" && Number.isFinite(item.startDate.getTime()) && Number.isFinite(item.endDate.getTime()) && item.startDate < item.endDate && item.endDate > input.todayStart && item.endDate <= input.todayEnd);
}
