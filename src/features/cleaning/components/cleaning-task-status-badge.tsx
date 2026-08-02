"use client";

import { useTranslations } from "next-intl";
import { CircleCheck, CircleDot, CircleSlash, LoaderCircle, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CleaningTaskViewModel } from "../cleaning.types";
import { getCleaningStatusMeta } from "../domain/cleaning-meta";

const icons = {
  "user-x": UserX,
  "circle-dot": CircleDot,
  loader: LoaderCircle,
  "circle-check": CircleCheck,
  "circle-slash": CircleSlash,
} as const;

export function CleaningTaskStatusBadge({ task }: { task: Pick<CleaningTaskViewModel, "status" | "assignee"> }) {
  const t = useTranslations("cleaning");
  const meta = getCleaningStatusMeta(task.status, Boolean(task.assignee));
  const Icon = icons[meta.icon];
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-full px-2 py-1 text-[11px] font-semibold", meta.className)}>
      <Icon className={cn("size-3", meta.displayStatus === "inProgress" && "animate-spin")} />
      {t(meta.labelKey)}
    </Badge>
  );
}
