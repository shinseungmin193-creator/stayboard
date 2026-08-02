"use client";

import { useTranslations } from "next-intl";
import { CircleCheck, Clock3, Sparkles, UserX } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CleaningPageData } from "../cleaning.types";

const cards = [
  { key: "urgent", icon: Sparkles, className: "border-red-200 bg-red-50 text-red-600 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-400" },
  { key: "flexible", icon: Clock3, className: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-400" },
  { key: "unassigned", icon: UserX, className: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300" },
  { key: "completed", icon: CircleCheck, className: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/30 dark:text-green-400" },
] as const;

export function CleaningSummaryGrid({ summary }: { summary: CleaningPageData["summary"] }) {
  const t = useTranslations("cleaning.summary");
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[29rem] grid-cols-4 gap-2 sm:min-w-0 sm:gap-3">
        {cards.map(({ key, icon: Icon, className }) => (
          <div key={key} className={cn("rounded-[14px] border p-2.5 shadow-sm sm:p-3", className)}>
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[11px] font-semibold sm:text-sm">{t(key)}</p>
              <Icon className="size-3.5 shrink-0 sm:size-4" />
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{summary[key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
