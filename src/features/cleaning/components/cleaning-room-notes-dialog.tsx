"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, CheckCircle2, LoaderCircle, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CleaningPhotoUploader } from "@/features/cleaning/components/cleaning-photo-uploader";
import { changeRoomNoteStatusAction } from "@/features/room-notes/room-note.actions";
import type { CleaningTaskViewModel } from "../cleaning.types";

export function CleaningRoomNotesDialog({ task, canComplete, onClose, onCompleted }: {
  task: CleaningTaskViewModel | null;
  canComplete: boolean;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const t = useTranslations("cleaning.roomNotes");
  const locale = useLocale();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const notes = task?.openRoomNotes.filter((note) => !completedIds.has(note.id)) ?? [];
  const dateTime = new Intl.DateTimeFormat(localeTag, {
    timeZone: task?.openRoomNotes[0]?.propertyTimeZone ?? "Asia/Tokyo",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const complete = (noteId: string) => {
    setPendingId(noteId);
    setError(null);
    startTransition(async () => {
      const result = await changeRoomNoteStatusAction({ id: noteId, status: "COMPLETED" });
      setPendingId(null);
      if (!result.success) {
        setError(result.message || t("completionFailed"));
        return;
      }
      setCompletedIds((current) => new Set(current).add(noteId));
      onCompleted(result.message ?? t("completed"));
    });
  };

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!pending}>
        {task && <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageSquareText className="size-5" />{t("dialogTitle", { room: task.roomName })}</DialogTitle>
            <DialogDescription>{t("dialogDescription", { count: notes.length })}</DialogDescription>
          </DialogHeader>
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">{error}</p>}
          {notes.length > 0 ? <div className="space-y-3">
            {notes.map((note) => <article key={note.id} className="space-y-3 rounded-2xl border p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{note.content}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{t("authorAndDate", { author: note.authorName, date: dateTime.format(new Date(note.createdAt)) })}</p>
                </div>
                {note.photoCount > 0 && <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground"><Camera className="size-3.5" />{note.photoCount}</span>}
              </div>
              {note.photos.length > 0 && note.cleaningTaskId && <CleaningPhotoUploader taskId={note.cleaningTaskId} initialPhotos={note.photos} readOnly onResult={() => undefined} />}
              {canComplete && <div className="flex justify-end">
                <Button type="button" size="sm" className="min-h-10 sm:min-h-8" disabled={pending} onClick={() => complete(note.id)}>
                  {pendingId === note.id ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}{t("complete")}
                </Button>
              </div>}
            </article>)}
          </div> : <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>}
        </>}
      </DialogContent>
    </Dialog>
  );
}
