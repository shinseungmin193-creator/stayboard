"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, FileClock, MessageSquareText, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UserRole } from "@/features/access-control";
import { saveCleaningTaskNoteAction, type CleaningActionResult } from "../cleaning.actions";
import type { CleaningTaskViewModel } from "../cleaning.types";
import { CleaningPhotoUploader } from "./cleaning-photo-uploader";
import { CleaningTaskStatusBadge } from "./cleaning-task-status-badge";

export function CleaningTaskDetailDialog({
  task,
  focus,
  role,
  currentUserId,
  locale,
  timeZone,
  pending,
  onClose,
  onResult,
  onRefresh,
}: {
  task: CleaningTaskViewModel | null;
  focus: "photos" | "note" | "logs" | null;
  role: UserRole;
  currentUserId: string;
  locale: string;
  timeZone: string;
  pending: boolean;
  onClose: () => void;
  onResult: (result: CleaningActionResult) => void;
  onRefresh: () => void;
}) {
  const t = useTranslations("cleaning");
  const [note, setNote] = useState(task?.note ?? "");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (focus === "note") setTimeout(() => noteRef.current?.focus(), 50); }, [focus, task]);
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone, year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), [locale, timeZone]);
  const actionable = task?.status === "PENDING" || task?.status === "IN_PROGRESS";
  const canWork = Boolean(task && (role !== "STAFF" || !task.assignee || task.assignee.userId === currentUserId || (task.assignee.userId === null && task.assignee.assignedById === currentUserId)));
  const activePhotoCount = task?.photos.filter((photo) => photo.url && !photo.deletedAt).length ?? 0;

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        {task && <>
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-8"><DialogTitle>{t("details.title", { room: task.roomName })}</DialogTitle><CleaningTaskStatusBadge task={task} /></div>
            <DialogDescription>{task.propertyName} · {dateTime.format(new Date(task.scheduledDate))}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-3 rounded-2xl border p-4">
              <h3 className="flex items-center gap-2 font-semibold"><UserRound className="size-4" />{t("details.workInfo")}</h3>
              <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t("fields.assignee")}</dt><dd className="break-words">{task.assignee?.name ?? t("status.unassigned")}</dd>
                <dt className="text-muted-foreground">{t("fields.cleanerName")}</dt><dd className="break-words">{task.cleanerName ?? t("none")}</dd>
                <dt className="text-muted-foreground">{t("fields.startedBy")}</dt><dd>{task.startedByName ?? t("none")}</dd>
                <dt className="text-muted-foreground">{t("fields.startedAt")}</dt><dd>{task.startedAt ? dateTime.format(new Date(task.startedAt)) : t("none")}</dd>
                <dt className="text-muted-foreground">{t("fields.completedBy")}</dt><dd>{task.completedBy?.name ?? t("none")}</dd>
                <dt className="text-muted-foreground">{t("fields.completedAt")}</dt><dd>{task.completedAt ? dateTime.format(new Date(task.completedAt)) : t("none")}</dd>
                <dt className="text-muted-foreground">{t("fields.photoCount")}</dt><dd>{t("photos.count", { count: task.photoCount })}</dd>
              </dl>
            </section>
            <section className="space-y-3 rounded-2xl border p-4">
              <h3 className="flex items-center gap-2 font-semibold"><Camera className="size-4" />{t("photos.title")}</h3>
              {actionable
                ? <CleaningPhotoUploader taskId={task.id} initialPhotos={task.photos} disabled={pending} onResult={onResult} onUploaded={onRefresh} />
                : activePhotoCount > 0
                  ? <CleaningPhotoUploader taskId={task.id} initialPhotos={task.photos} readOnly onResult={onResult} />
                  : <p className="rounded-xl bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">{task.photoRetentionExpired ? t("photos.retentionExpired") : t("photos.none")}</p>}
            </section>
          </div>
          <section className="space-y-3 rounded-2xl border p-4">
            <h3 className="flex items-center gap-2 font-semibold"><MessageSquareText className="size-4" />{t("details.note")}</h3>
            {actionable && canWork ? <>
              <textarea ref={noteRef} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" placeholder={t("details.notePlaceholder")} />
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{note.trim().length}/500</span><Button type="button" size="sm" disabled={pending || !note.trim()} onClick={async () => { const result = await saveCleaningTaskNoteAction({ taskId: task.id, note }); onResult(result); if (result.success) onRefresh(); }}>{t("actions.saveNote")}</Button></div>
            </> : <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.note || t("details.noNote")}</p>}
          </section>
          <section className="space-y-3 rounded-2xl border p-4">
            <h3 className="flex items-center gap-2 font-semibold"><FileClock className="size-4" />{t("details.history")}</h3>
            {task.logs.length > 0 ? <ol className="space-y-2">{task.logs.map((log) => <li key={log.id} className="flex gap-3 rounded-xl bg-muted/40 p-3 text-sm"><span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><p className="font-medium">{t(`logs.${log.action}`)}</p><p className="text-xs text-muted-foreground">{log.workerName || log.actorName || t("none")} · {dateTime.format(new Date(log.createdAt))}</p></div></li>)}</ol> : <p className="py-4 text-center text-sm text-muted-foreground">{t("details.noHistory")}</p>}
          </section>
        </>}
      </DialogContent>
    </Dialog>
  );
}
