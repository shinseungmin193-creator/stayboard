import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";

export const ROOM_OPERATIONAL_STATUS_VALUES = ["NONE", "CLEANING_REQUIRED", "INSPECTION_REQUIRED"] as const satisfies readonly RoomOperationalStatus[];
export const ROOM_OPERATIONAL_STATUS_META = {
  NONE: { label: "상태 없음", badgeClassName: "" },
  CLEANING_REQUIRED: { label: "청소 필요", badgeClassName: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  INSPECTION_REQUIRED: { label: "점검 필요", badgeClassName: "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200" },
} satisfies Record<RoomOperationalStatus, { label: string; badgeClassName: string }>;

export const ROOM_OPERATION_POLICY = { autoMarkCleaningRequired: false } as const;

export function shouldMarkCleaningRequired(input: { operationalStatus: RoomOperationalStatus; reservations: Array<{ status: string; startDate: Date; endDate: Date }>; todayStart: Date; todayEnd: Date }) {
  if (!ROOM_OPERATION_POLICY.autoMarkCleaningRequired || input.operationalStatus !== "NONE") return false;
  return input.reservations.some((item) => item.status !== "CANCELLED" && item.status !== "BLOCKED" && Number.isFinite(item.startDate.getTime()) && Number.isFinite(item.endDate.getTime()) && item.startDate < item.endDate && item.endDate > input.todayStart && item.endDate <= input.todayEnd);
}
