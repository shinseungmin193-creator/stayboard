"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@/features/access-control";
import {
  assignCleaningTaskAction,
  completeCleaningTaskAction,
  startCleaningTaskAction,
  type CleaningActionResult,
} from "../cleaning.actions";
import type { CleaningFilters, CleaningPageData, CleaningTaskViewModel } from "../cleaning.types";
import { formatCleaningSelectedDate, getCleaningDateInput, shiftCleaningDate } from "../domain/cleaning-date";
import { CLEANING_SECTIONS, type CleaningSection as CleaningSectionName } from "../domain/cleaning-meta";
import { CleaningFilterSheet } from "./cleaning-filter-sheet";
import { CleaningSection } from "./cleaning-section";
import { CleaningSummaryGrid } from "./cleaning-summary-grid";
import { CleaningTaskDetailDialog } from "./cleaning-task-detail-dialog";
import { CleaningWorkflowDialog, type CleaningWorkflowMode } from "./cleaning-workflow-dialog";

export function CleaningWorkspace({
  filters,
  data,
  currentUserId,
  currentUserName,
  role,
}: {
  filters: CleaningFilters;
  data: CleaningPageData;
  currentUserId: string;
  currentUserName: string;
  role: UserRole;
}) {
  const t = useTranslations("cleaning");
  const common = useTranslations("common");
  const locale = useLocale();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const router = useRouter();
  const pathname = usePathname();
  const [detail, setDetail] = useState<{ task: CleaningTaskViewModel; focus: "photos" | "note" | "logs" | null } | null>(null);
  const [workflow, setWorkflow] = useState<{ task: CleaningTaskViewModel; mode: CleaningWorkflowMode } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = getCleaningDateInput(new Date(), data.timeZone);
  const selectedDateLabel = formatCleaningSelectedDate({ date: filters.date, locale, timeZone: data.timeZone });

  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 2800);
  };

  const navigate = (patch: Partial<CleaningFilters>) => {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    params.set("date", next.date);
    if (next.companyId) params.set("companyId", next.companyId);
    if (next.propertyId) params.set("propertyId", next.propertyId);
    if (next.roomId) params.set("roomId", next.roomId);
    if (next.assigneeId) params.set("assigneeId", next.assigneeId);
    if (next.status) params.set("status", next.status);
    if (next.priority) params.set("priority", next.priority);
    if (next.unassignedOnly) params.set("unassignedOnly", "true");
    if (next.section !== "all") params.set("section", next.section);
    if (next.page > 1) params.set("page", String(next.page));
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  const handleResult = (result: CleaningActionResult) => {
    showNotice(result.message);
    if (result.success || result.code === "CONFLICT" || result.code === "ALREADY_ASSIGNED") router.refresh();
  };

  const runWorkflow = (input: { task: CleaningTaskViewModel; mode: CleaningWorkflowMode; workerName: string; assigneeUserId?: string }) => {
    startTransition(async () => {
      const result = input.mode === "assign" || input.mode === "reassign"
        ? await assignCleaningTaskAction({ taskId: input.task.id, workerName: input.workerName, assigneeUserId: input.assigneeUserId ?? currentUserId })
        : input.mode === "start"
          ? await startCleaningTaskAction({ taskId: input.task.id, workerName: input.workerName })
          : await completeCleaningTaskAction({ taskId: input.task.id, workerName: input.workerName });
      handleResult(result);
      if (result.success) setWorkflow(null);
    });
  };

  const sections: readonly CleaningSectionName[] = filters.section === "all" ? CLEANING_SECTIONS : [filters.section];
  const selectedData = filters.section !== "all" ? data.sections[filters.section] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1 rounded-xl border bg-card p-1 shadow-sm">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("date.previous")} disabled={isPending} onClick={() => navigate({ date: shiftCleaningDate(filters.date, -1), page: 1 })}><ChevronLeft /></Button>
          <label className="relative flex min-w-0 items-center gap-2 px-1.5">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold">{selectedDateLabel}</span>
            <input type="date" value={filters.date} aria-label={t("date.select")} onChange={(event) => navigate({ date: event.target.value, page: 1 })} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("date.next")} disabled={isPending} onClick={() => navigate({ date: shiftCleaningDate(filters.date, 1), page: 1 })}><ChevronRight /></Button>
        </div>
        <CleaningFilterSheet filters={filters} data={data} onApply={(patch) => navigate(patch)} />
      </div>
      {filters.date !== today && <div className="-mt-2"><Button type="button" variant="link" size="xs" onClick={() => navigate({ date: today, page: 1 })}>{common("today")}</Button></div>}

      <CleaningSummaryGrid summary={data.summary} />

      {isPending && <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />{t("loading")}</div>}

      <div className="space-y-5">
        {sections.map((section) => <CleaningSection key={section} section={section} data={data.sections[section]} selected={filters.section === section} role={role} currentUserId={currentUserId} referenceAt={data.referenceAt} timeZone={data.timeZone} locale={localeTag} pending={isPending} onViewAll={(nextSection) => navigate({ section: nextSection, page: 1 })} onOpenDetails={(task, focus) => setDetail({ task, focus: focus ?? null })} onWorkflow={(task, mode) => setWorkflow({ task, mode })} />)}
      </div>

      {selectedData && selectedData.totalPages > 1 && <nav className="flex items-center justify-center gap-2" aria-label={t("pagination.label")}>
        <Button type="button" variant="outline" size="sm" disabled={selectedData.page <= 1 || isPending} onClick={() => navigate({ page: selectedData.page - 1 })}>{t("pagination.previous")}</Button>
        <span className="text-sm font-medium">{t("pagination.current", { page: selectedData.page, total: selectedData.totalPages })}</span>
        <Button type="button" variant="outline" size="sm" disabled={selectedData.page >= selectedData.totalPages || isPending} onClick={() => navigate({ page: selectedData.page + 1 })}>{t("pagination.next")}</Button>
      </nav>}

      {workflow && <CleaningWorkflowDialog key={`${workflow.task.id}-${workflow.mode}`} task={workflow.task} mode={workflow.mode} role={role} currentUserId={currentUserId} currentUserName={currentUserName} pending={isPending} onClose={() => setWorkflow(null)} onSubmit={runWorkflow} />}
      {detail && <CleaningTaskDetailDialog key={`${detail.task.id}-${detail.focus ?? "details"}`} task={detail.task} focus={detail.focus} role={role} currentUserId={currentUserId} locale={localeTag} timeZone={data.timeZone} pending={isPending} onClose={() => setDetail(null)} onResult={handleResult} onRefresh={() => router.refresh()} />}
      {notice && <div className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-sm rounded-xl bg-foreground px-4 py-3 text-center text-sm font-medium text-background shadow-lg lg:bottom-6" role="status" aria-live="polite">{notice}</div>}
    </div>
  );
}
