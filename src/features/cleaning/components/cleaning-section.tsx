"use client";

import { useTranslations } from "next-intl";
import { Clock3, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@/features/access-control";
import { cn } from "@/lib/utils";
import type { CleaningSectionData, CleaningTaskViewModel } from "../cleaning.types";
import { getCleaningSectionTone, type CleaningSection as CleaningSectionName } from "../domain/cleaning-meta";
import type { CleaningWorkflowMode } from "./cleaning-workflow-dialog";
import { CleaningTaskCard } from "./cleaning-task-card";

const icons = { urgent: Sparkles, flexible: Clock3 } as const;

export function CleaningSection({
  section,
  data,
  selected,
  role,
  currentUserId,
  referenceAt,
  timeZone,
  locale,
  pending,
  onViewAll,
  onOpenDetails,
  onWorkflow,
}: {
  section: CleaningSectionName;
  data: CleaningSectionData;
  selected: boolean;
  role: UserRole;
  currentUserId: string;
  referenceAt: string;
  timeZone: string;
  locale: string;
  pending: boolean;
  onViewAll: (section: CleaningSectionName | "all") => void;
  onOpenDetails: (task: CleaningTaskViewModel, focus?: "photos" | "note" | "logs") => void;
  onWorkflow: (task: CleaningTaskViewModel, mode: CleaningWorkflowMode) => void;
}) {
  const t = useTranslations("cleaning");
  const tone = getCleaningSectionTone(section);
  const Icon = icons[section];
  return (
    <section className="space-y-3" aria-labelledby={`cleaning-section-${section}`}>
      <header className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5", tone.border, tone.background)}>
        <div className={cn("flex min-w-0 items-center gap-2 font-semibold", tone.accent)}>
          <Icon className="size-4 shrink-0" />
          <h2 id={`cleaning-section-${section}`} className="truncate">{t(tone.labelKey)}</h2>
          <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-bold tabular-nums text-foreground">{data.totalCount}</span>
        </div>
        {(selected || data.totalCount > data.items.length) && <Button type="button" variant="ghost" size="xs" onClick={() => onViewAll(selected ? "all" : section)}>{selected ? t("sections.allSections") : t("sections.viewAll")}</Button>}
      </header>
      {data.items.length > 0 ? <div className="space-y-2.5">{data.items.map((task) => <CleaningTaskCard key={task.id} task={task} role={role} currentUserId={currentUserId} referenceAt={referenceAt} timeZone={timeZone} locale={locale} pending={pending} onOpenDetails={onOpenDetails} onWorkflow={onWorkflow} />)}</div> : <div className="rounded-2xl border border-dashed bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">{t(`sections.empty.${section}`)}</div>}
    </section>
  );
}
