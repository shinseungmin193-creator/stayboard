"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Camera, CircleCheck, Clock3, Ellipsis, FileClock, MessageSquareText, Pencil, Play, RotateCcw, Undo2, UserRoundPlus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/features/access-control";
import { cn } from "@/lib/utils";
import type { CleaningTaskViewModel } from "../cleaning.types";
import { getCleaningPriorityMeta } from "../domain/cleaning-meta";
import { isCleaningRecordCompleted } from "../domain/cleaning-record-status";
import { getCleaningTimeStatus } from "../domain/cleaning-time";
import type { CleaningWorkflowMode } from "./cleaning-workflow-dialog";
import { CleaningTaskStatusBadge } from "./cleaning-task-status-badge";
import { CleaningRoomNoteSummary } from "./cleaning-room-note-summary";

function formatRemainingTime(status: ReturnType<typeof getCleaningTimeStatus>, t: ReturnType<typeof useTranslations>) {
  if (status.kind === "none") return t("time.noTarget");
  if (status.kind === "completed") return t("time.completed");
  if (status.hours === 0) return t(status.kind === "remaining" ? "time.minutesRemaining" : "time.minutesDelayed", { minutes: status.minutes });
  if (status.minutes === 0) return t(status.kind === "remaining" ? "time.hoursRemaining" : "time.hoursDelayed", { hours: status.hours });
  return t(status.kind === "remaining" ? "time.hoursMinutesRemaining" : "time.hoursMinutesDelayed", { hours: status.hours, minutes: status.minutes });
}

export function CleaningTaskCard({
  task,
  role,
  currentUserId,
  referenceAt,
  timeZone,
  locale,
  pending,
  canManageCompletion,
  onOpenDetails,
  onOpenRoomNotes,
  onCancelStart,
  onEditCompletion,
  onRevertCompletion,
  onWorkflow,
}: {
  task: CleaningTaskViewModel;
  role: UserRole;
  currentUserId: string;
  referenceAt: string;
  timeZone: string;
  locale: string;
  pending: boolean;
  canManageCompletion: boolean;
  onOpenDetails: (task: CleaningTaskViewModel, focus?: "photos" | "note" | "logs") => void;
  onOpenRoomNotes: (task: CleaningTaskViewModel) => void;
  onCancelStart: (task: CleaningTaskViewModel) => void;
  onEditCompletion: (task: CleaningTaskViewModel) => void;
  onRevertCompletion: (task: CleaningTaskViewModel) => void;
  onWorkflow: (task: CleaningTaskViewModel, mode: CleaningWorkflowMode) => void;
}) {
  const t = useTranslations("cleaning");
  const meta = getCleaningPriorityMeta(task.priority);
  const isCompleted = isCleaningRecordCompleted(task);
  const hasAssignee = Boolean(task.assignee);
  const canWork = role !== "STAFF"
    || !hasAssignee
    || task.assignee?.userId === currentUserId
    || (task.assignee?.userId === null && task.assignee?.assignedById === currentUserId);
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), [locale, timeZone]);
  const time = getCleaningTimeStatus({ targetAt: task.targetAt ? new Date(task.targetAt) : null, referenceAt: new Date(referenceAt), completedAt: task.completedAt ? new Date(task.completedAt) : null });
  const completedWorkerName = task.cleanerName ?? task.assignee?.name ?? task.completedBy?.name ?? t("status.unassigned");
  const action = isCompleted
    ? { label: t("actions.details"), icon: FileClock, run: () => onOpenDetails(task, "logs"), variant: "outline" as const }
    : task.status === "IN_PROGRESS"
      ? { label: t("actions.complete"), icon: CircleCheck, run: () => onWorkflow(task, "complete"), variant: "default" as const }
      : { label: t("actions.start"), icon: Play, run: () => onWorkflow(task, "start"), variant: "default" as const };
  const ActionIcon = action.icon;
  const primaryActionDisabled = pending || (task.status === "IN_PROGRESS" && !canWork);

  return (
    <article data-cleaning-task-id={task.id} className={cn("min-w-0 rounded-2xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4", isCompleted ? "border-border bg-muted/10" : meta.border)}>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(12rem,1.2fr)_minmax(16rem,1fr)_auto] lg:items-center">
        <button type="button" className="min-w-0 text-left outline-none" onClick={() => onOpenDetails(task)}>
          <div className="flex min-w-0 items-start justify-between gap-2 lg:block">
            <div className="min-w-0">
              <p className="truncate text-base font-bold sm:text-lg">{task.roomName}</p>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{task.propertyName}</p>
            </div>
            <CleaningTaskStatusBadge task={task} />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{t("card.checkoutAt", { time: dateTime.format(new Date(task.scheduledDate)) })}</p>
        </button>

        <div className="min-w-0 space-y-2">
          <CleaningRoomNoteSummary notes={task.openRoomNotes} onOpen={() => onOpenRoomNotes(task)} />
          {isCompleted
            ? <dl className="grid min-w-0 grid-cols-2 gap-2 rounded-xl bg-muted/35 p-2.5 text-xs sm:grid-cols-4">
                <div className="min-w-0"><dt className="text-muted-foreground">{t("fields.completedAt")}</dt><dd className="mt-0.5 truncate font-semibold">{task.completedAt ? dateTime.format(new Date(task.completedAt)) : t("none")}</dd></div>
                <div className="min-w-0"><dt className="text-muted-foreground">{t("fields.assignee")}</dt><dd className="mt-0.5 truncate font-semibold">{completedWorkerName}</dd></div>
                <div className="min-w-0"><dt className="text-muted-foreground">{t("fields.photoCount")}</dt><dd className="mt-0.5 truncate font-semibold">{t("photos.count", { count: task.photoCount })}</dd></div>
                <div className="min-w-0"><dt className="text-muted-foreground">{t("details.note")}</dt><dd className="mt-0.5 truncate font-semibold">{task.note || t("details.noNote")}</dd></div>
              </dl>
            : <div className="grid min-w-0 grid-cols-2 gap-2 rounded-xl bg-muted/35 p-2.5 text-xs sm:grid-cols-3">
                <div className="min-w-0"><p className="text-muted-foreground">{t("card.targetTime")}</p><p className="mt-0.5 truncate font-semibold">{task.targetAt ? dateTime.format(new Date(task.targetAt)) : t("time.noTarget")}</p></div>
                <div className="min-w-0"><p className="text-muted-foreground">{t("card.timeStatus")}</p><p className={cn("mt-0.5 truncate font-semibold", time.kind === "delayed" && "text-red-600 dark:text-red-400")}>{formatRemainingTime(time, t)}</p></div>
                <div className="col-span-2 min-w-0 sm:col-span-1"><p className="text-muted-foreground">{t("fields.assignee")}</p><p className="mt-0.5 truncate font-semibold">{task.assignee?.name ?? t("status.unassigned")}</p></div>
              </div>}
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {!isCompleted && task.status === "IN_PROGRESS" && <Button type="button" size="sm" variant="outline" data-cleaning-photo-action={task.id} disabled={pending} onClick={() => onOpenDetails(task, "photos")}><Camera />{t("actions.addPhoto")}</Button>}
          {!isCompleted && task.status === "IN_PROGRESS" && <Button type="button" size="sm" variant="outline" data-cleaning-cancel-start-action={task.id} disabled={pending} onClick={() => onCancelStart(task)}><RotateCcw />{t("actions.cancelStart")}</Button>}
          <button
            type="button"
            data-cleaning-primary-action={task.id}
            className={cn(buttonVariants({ size: "sm", variant: action.variant }), action.variant === "default" && meta.button)}
            disabled={primaryActionDisabled}
            onClick={(event) => {
              event.stopPropagation();
              action.run();
            }}
          >
            <ActionIcon />{action.label}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" data-cleaning-menu-action={task.id} aria-label={t("actions.more")} />}><Ellipsis /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onOpenDetails(task)}><FileClock />{t("actions.details")}</DropdownMenuItem>
              {!isCompleted && role !== "STAFF" && <DropdownMenuItem onClick={() => onWorkflow(task, "reassign")}><UserRoundPlus />{t("actions.changeAssignee")}</DropdownMenuItem>}
              {!isCompleted && <DropdownMenuItem disabled={!canWork} onClick={() => onOpenDetails(task, "note")}><MessageSquareText />{t("actions.note")}</DropdownMenuItem>}
              {isCompleted && <DropdownMenuItem onClick={() => onOpenDetails(task, "logs")}><FileClock />{t("actions.history")}</DropdownMenuItem>}
              {isCompleted && canManageCompletion && <DropdownMenuItem data-cleaning-completion-edit={task.id} onClick={() => onEditCompletion(task)}><Pencil />{t("actions.editCompletion")}</DropdownMenuItem>}
              {isCompleted && canManageCompletion && <DropdownMenuItem data-cleaning-completion-revert-menu={task.id} className="text-destructive focus:text-destructive" onClick={() => onRevertCompletion(task)}><Undo2 />{t("actions.revertCompletion")}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
