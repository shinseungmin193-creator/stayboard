import type { CleaningPriority } from "./cleaning-priority";

export const CLEANING_SECTIONS = ["urgent", "flexible"] as const;
export const CLEANING_LIST_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

export type CleaningSection = (typeof CLEANING_SECTIONS)[number];
export type CleaningDisplayStatus = "unassigned" | "waiting" | "inProgress" | "completed" | "cancelled";

export function isCleaningSection(value: string | undefined): value is CleaningSection {
  return CLEANING_SECTIONS.includes(value as CleaningSection);
}

const SECTION_META = {
  urgent: {
    labelKey: "sections.urgent",
    icon: "sparkles",
    accent: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-900/70",
    background: "bg-red-50 dark:bg-red-950/30",
    button: "bg-red-500 text-white hover:bg-red-600",
  },
  flexible: {
    labelKey: "sections.flexible",
    icon: "clock",
    accent: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-900/70",
    background: "bg-amber-50 dark:bg-amber-950/30",
    button: "bg-amber-500 text-white hover:bg-amber-600",
  },
} as const;

const STATUS_META = {
  unassigned: {
    labelKey: "status.unassigned",
    icon: "user-x",
    className: "border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  },
  waiting: {
    labelKey: "status.waiting",
    icon: "circle-dot",
    className: "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
  inProgress: {
    labelKey: "status.inProgress",
    icon: "loader",
    className: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  completed: {
    labelKey: "status.completed",
    icon: "circle-check",
    className: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  },
  cancelled: {
    labelKey: "status.cancelled",
    icon: "circle-slash",
    className: "border-border bg-muted text-muted-foreground",
  },
} as const;

export function getCleaningSectionTone(section: CleaningSection) {
  return SECTION_META[section];
}

export function getCleaningPriorityMeta(priority: CleaningPriority) {
  return priority === "urgent" ? SECTION_META.urgent : SECTION_META.flexible;
}

export function getCleaningStatusMeta(
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  hasAssignee: boolean,
) {
  const displayStatus: CleaningDisplayStatus = status === "COMPLETED"
    ? "completed"
    : status === "IN_PROGRESS"
      ? "inProgress"
      : status === "CANCELLED"
        ? "cancelled"
        : hasAssignee
          ? "waiting"
          : "unassigned";
  return { displayStatus, ...STATUS_META[displayStatus] };
}
