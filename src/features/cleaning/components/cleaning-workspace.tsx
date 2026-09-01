"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@/features/access-control";
import {
  assignCleaningTaskAction,
  cancelCleaningTaskStartAction,
  completeCleaningTaskAction,
  startCleaningTaskAction,
  type CleaningActionResult,
} from "../cleaning.actions";
import type { CleaningFilters, CleaningPageData, CleaningTaskViewModel, CleaningWorkerViewModel } from "../cleaning.types";
import { formatCleaningSelectedDate, getCleaningDateInput, shiftCleaningDate } from "../domain/cleaning-date";
import { CLEANING_SECTIONS, type CleaningSection as CleaningSectionName } from "../domain/cleaning-meta";
import { upsertCleaningWorkerList } from "../domain/cleaning-worker";
import { CleaningFilterSheet } from "./cleaning-filter-sheet";
import { CleaningHistoryList } from "./cleaning-history-list";
import { CleaningSection } from "./cleaning-section";
import { CleaningSummaryGrid } from "./cleaning-summary-grid";
import { CleaningStartCancelDialog } from "./cleaning-start-cancel-dialog";
import { CleaningTaskDetailDialog } from "./cleaning-task-detail-dialog";
import { CleaningRoomNotesDialog } from "./cleaning-room-notes-dialog";
import { CleaningWorkflowDialog, type CleaningWorkflowMode } from "./cleaning-workflow-dialog";
import { CleaningWorkerManager } from "./cleaning-worker-manager";

export function CleaningWorkspace({
  filters,
  data,
  currentUserId,
  currentUserName,
  role,
  canCreateWorkers,
  canManageWorkers,
  canCompleteRoomNotes,
}: {
  filters: CleaningFilters;
  data: CleaningPageData;
  currentUserId: string;
  currentUserName: string;
  role: UserRole;
  canCreateWorkers: boolean;
  canManageWorkers: boolean;
  canCompleteRoomNotes: boolean;
}) {
  const t = useTranslations("cleaning");
  const common = useTranslations("common");
  const locale = useLocale();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const router = useRouter();
  const pathname = usePathname();
  const [detail, setDetail] = useState<{ taskId: string; focus: "photos" | "note" | "logs" | null } | null>(null);
  const [workflow, setWorkflow] = useState<{ taskId: string; mode: CleaningWorkflowMode } | null>(null);
  const [startCancellationTaskId, setStartCancellationTaskId] = useState<string | null>(null);
  const [roomNotesTaskId, setRoomNotesTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [workerUpdates, setWorkerUpdates] = useState<CleaningWorkerViewModel[]>([]);
  const [isNavigating, startNavigationTransition] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = getCleaningDateInput(new Date(), data.timeZone);
  const selectedDateLabel = formatCleaningSelectedDate({ date: filters.date, locale, timeZone: data.timeZone });
  const tasksById = new Map([
    ...CLEANING_SECTIONS.flatMap((section) => data.sections[section].items),
    ...data.history.items,
  ].map((task) => [task.id, task]));
  const detailTask = detail ? tasksById.get(detail.taskId) ?? null : null;
  const workflowTask = workflow ? tasksById.get(workflow.taskId) ?? null : null;
  const requestedStartCancellationTask = startCancellationTaskId ? tasksById.get(startCancellationTaskId) ?? null : null;
  const startCancellationTask = requestedStartCancellationTask?.status === "IN_PROGRESS" ? requestedStartCancellationTask : null;
  const roomNotesTask = roomNotesTaskId ? tasksById.get(roomNotesTaskId) ?? null : null;
  const workers = useMemo(
    () => workerUpdates.reduce<CleaningWorkerViewModel[]>((current, worker) => upsertCleaningWorkerList(current, worker), data.workers),
    [data.workers, workerUpdates],
  );

  const updateWorker = (worker: CleaningWorkerViewModel) => {
    setWorkerUpdates((current) => upsertCleaningWorkerList(current, worker));
  };

  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 2800);
  };

  const navigate = (patch: Partial<CleaningFilters>) => {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    if (next.tab === "history") params.set("tab", "history");
    params.set("date", next.date);
    if (next.companyId) params.set("companyId", next.companyId);
    if (next.propertyId) params.set("propertyId", next.propertyId);
    if (next.roomId) params.set("roomId", next.roomId);
    if (next.assigneeId) params.set("assigneeId", next.assigneeId);
    if (next.tab === "ongoing" && next.status) params.set("status", next.status);
    if (next.tab === "ongoing" && next.priority) params.set("priority", next.priority);
    if (next.tab === "ongoing" && next.unassignedOnly) params.set("unassignedOnly", "true");
    if (next.tab === "ongoing" && next.section !== "all") params.set("section", next.section);
    if (next.page > 1) params.set("page", String(next.page));
    startNavigationTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  const handleResult = (result: CleaningActionResult) => {
    showNotice(result.message);
    if (result.success || result.code === "CONFLICT" || result.code === "ALREADY_ASSIGNED" || result.code === "ALREADY_COMPLETED" || result.code === "NOT_IN_PROGRESS") router.refresh();
  };

  const cancelStart = (task: CleaningTaskViewModel) => {
    if (pendingTaskId) return;
    setPendingTaskId(task.id);
    startActionTransition(async () => {
      try {
        const result = await cancelCleaningTaskStartAction({ taskId: task.id });
        handleResult(result);
        if (result.success || result.code === "CONFLICT" || result.code === "ALREADY_COMPLETED" || result.code === "NOT_IN_PROGRESS") {
          setStartCancellationTaskId(null);
        }
      } finally {
        setPendingTaskId(null);
      }
    });
  };

  const runWorkflow = (input: { task: CleaningTaskViewModel; mode: CleaningWorkflowMode; workerName: string; assigneeUserId?: string }) => {
    if (pendingTaskId) return;
    setPendingTaskId(input.task.id);
    startActionTransition(async () => {
      try {
        const result = input.mode === "assign" || input.mode === "reassign"
          ? await assignCleaningTaskAction({ taskId: input.task.id, workerName: input.workerName, assigneeUserId: input.assigneeUserId ?? currentUserId })
          : input.mode === "start"
            ? await startCleaningTaskAction({ taskId: input.task.id, workerName: input.workerName })
            : await completeCleaningTaskAction({ taskId: input.task.id, workerName: input.workerName });
        handleResult(result);
        if (result.success) setWorkflow(null);
      } finally {
        setPendingTaskId(null);
      }
    });
  };

  const sections: readonly CleaningSectionName[] = filters.section === "all" ? CLEANING_SECTIONS : [filters.section];
  const selectedData = filters.section !== "all" ? data.sections[filters.section] : null;
  const paginationData = filters.tab === "history" ? data.history : selectedData;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border bg-muted/40 p-1" role="tablist" aria-label={t("tabs.label")}>
        {(["ongoing", "history"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={filters.tab === tab} disabled={isNavigating} onClick={() => navigate({ tab, status: null, priority: null, unassignedOnly: false, assigneeId: filters.assigneeId === "unassigned" ? null : filters.assigneeId, section: "all", page: 1 })} className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-60 ${filters.tab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t(`tabs.${tab}`)}</button>)}
      </div>

      <div className="flex items-center justify-between gap-3">
        {filters.tab === "ongoing" ? <div className="flex min-w-0 items-center gap-1 rounded-xl border bg-card p-1 shadow-sm">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("date.previous")} disabled={isNavigating} onClick={() => navigate({ date: shiftCleaningDate(filters.date, -1), page: 1 })}><ChevronLeft /></Button>
          <label className="relative flex min-w-0 items-center gap-2 px-1.5">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold">{selectedDateLabel}</span>
            <input type="date" value={filters.date} aria-label={t("date.select")} onChange={(event) => navigate({ date: event.target.value, page: 1 })} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("date.next")} disabled={isNavigating} onClick={() => navigate({ date: shiftCleaningDate(filters.date, 1), page: 1 })}><ChevronRight /></Button>
        </div> : <div />}
        <div className="flex shrink-0 items-center gap-2">
          {canManageWorkers && <CleaningWorkerManager companies={data.companies} workers={workers} onWorkerChanged={updateWorker} onNotice={showNotice} />}
          <CleaningFilterSheet filters={filters} data={data} onApply={(patch) => navigate(patch)} />
        </div>
      </div>
      {filters.tab === "ongoing" && filters.date !== today && <div className="-mt-2"><Button type="button" variant="link" size="xs" onClick={() => navigate({ date: today, page: 1 })}>{common("today")}</Button></div>}

      {filters.tab === "ongoing" && <CleaningSummaryGrid summary={data.summary} />}

      {(isNavigating || isActionPending) && <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />{t("loading")}</div>}

      {filters.tab === "ongoing" ? <div className="space-y-5">
        {sections.map((section) => <CleaningSection key={section} section={section} data={data.sections[section]} selected={filters.section === section} role={role} currentUserId={currentUserId} referenceAt={data.referenceAt} timeZone={data.timeZone} locale={localeTag} pendingTaskId={pendingTaskId} onViewAll={(nextSection) => navigate({ section: nextSection, page: 1 })} onOpenDetails={(task, focus) => setDetail({ taskId: task.id, focus: focus ?? null })} onOpenRoomNotes={(task) => setRoomNotesTaskId(task.id)} onCancelStart={(task) => setStartCancellationTaskId(task.id)} onWorkflow={(task, mode) => setWorkflow({ taskId: task.id, mode })} />)}
      </div> : <CleaningHistoryList data={data.history} locale={localeTag} timeZone={data.timeZone} referenceAt={data.referenceAt} onOpenDetails={(task, focus) => setDetail({ taskId: task.id, focus: focus ?? null })} />}

      {paginationData && paginationData.totalPages > 1 && <nav className="flex items-center justify-center gap-2" aria-label={t("pagination.label")}>
        <Button type="button" variant="outline" size="sm" disabled={paginationData.page <= 1 || isNavigating} onClick={() => navigate({ page: paginationData.page - 1 })}>{t("pagination.previous")}</Button>
        <span className="text-sm font-medium">{t("pagination.current", { page: paginationData.page, total: paginationData.totalPages })}</span>
        <Button type="button" variant="outline" size="sm" disabled={paginationData.page >= paginationData.totalPages || isNavigating} onClick={() => navigate({ page: paginationData.page + 1 })}>{t("pagination.next")}</Button>
      </nav>}

      {workflow && workflowTask && <CleaningWorkflowDialog key={`${workflow.taskId}-${workflow.mode}`} task={workflowTask} mode={workflow.mode} role={role} currentUserId={currentUserId} currentUserName={currentUserName} registeredWorkers={workers} canCreateWorkers={canCreateWorkers} pending={pendingTaskId === workflow.taskId || isActionPending} onClose={() => setWorkflow(null)} onSubmit={runWorkflow} onUploadResult={handleResult} onPhotoUploaded={() => router.refresh()} onReviewRoomNotes={() => { setWorkflow(null); setRoomNotesTaskId(workflowTask.id); }} onWorkerCreated={updateWorker} onNotice={showNotice} />}
      {startCancellationTask && <CleaningStartCancelDialog task={startCancellationTask} pending={pendingTaskId === startCancellationTask.id || isActionPending} onClose={() => setStartCancellationTaskId(null)} onConfirm={cancelStart} />}
      {detail && detailTask && <CleaningTaskDetailDialog key={`${detail.taskId}-${detail.focus ?? "details"}`} task={detailTask} focus={detail.focus} role={role} currentUserId={currentUserId} locale={localeTag} timeZone={data.timeZone} pending={pendingTaskId === detail.taskId} onClose={() => setDetail(null)} onResult={handleResult} onRefresh={() => router.refresh()} />}
      {roomNotesTask && <CleaningRoomNotesDialog key={roomNotesTask.id} task={roomNotesTask} canComplete={canCompleteRoomNotes} onClose={() => setRoomNotesTaskId(null)} onCompleted={(message) => { showNotice(message); router.refresh(); }} />}
      {notice && <div className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-sm rounded-xl bg-foreground px-4 py-3 text-center text-sm font-medium text-background shadow-lg lg:bottom-6" role="status" aria-live="polite">{notice}</div>}
    </div>
  );
}
