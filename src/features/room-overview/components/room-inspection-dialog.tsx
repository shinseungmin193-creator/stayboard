"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, ExternalLink, LoaderCircle, RotateCcw, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CleaningPhotoUploader } from "@/features/cleaning/components/cleaning-photo-uploader";
import { changeRoomNoteStatusAction, getPendingRoomNotesAction } from "@/features/room-notes/room-note.actions";
import type { RoomNoteViewModel } from "@/features/room-notes/room-note.types";

interface InspectionRoom {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;
  pendingMemoCount: number;
}

type FetchState =
  | { status: "IDLE" | "LOADING"; notes: RoomNoteViewModel[] }
  | { status: "SUCCESS"; notes: RoomNoteViewModel[] }
  | { status: "FAILED"; notes: RoomNoteViewModel[] };

const INITIAL_STATE: FetchState = { status: "IDLE", notes: [] };

export function RoomInspectionDialog({ room, open, canComplete, onOpenChange, onPendingMemoCountChange }: {
  room: InspectionRoom | null;
  open: boolean;
  canComplete: boolean;
  onOpenChange: (open: boolean) => void;
  onPendingMemoCountChange: (roomId: string, count: number) => void;
}) {
  const i18n = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const cacheRef = useRef(new Map<string, RoomNoteViewModel[]>());
  const requestSequenceRef = useRef(0);
  const [fetchState, setFetchState] = useState<FetchState>(INITIAL_STATE);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = useCallback(() => {
    requestSequenceRef.current += 1;
    setActionError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const load = useCallback(async (target: InspectionRoom) => {
    const requestSequence = ++requestSequenceRef.current;
    setActionError(null);
    setFetchState({ status: "LOADING", notes: [] });
    try {
      const result = await getPendingRoomNotesAction({ roomId: target.id });
      if (requestSequence !== requestSequenceRef.current) return;
      if (!result.success || !result.data) {
        setFetchState({ status: "FAILED", notes: [] });
        return;
      }
      const notes = result.data.notes;
      cacheRef.current.set(target.id, notes);
      onPendingMemoCountChange(target.id, notes.length);
      if (!notes.length) {
        close();
        return;
      }
      setFetchState({ status: "SUCCESS", notes });
    } catch {
      if (requestSequence === requestSequenceRef.current) setFetchState({ status: "FAILED", notes: [] });
    }
  }, [close, onPendingMemoCountChange]);

  useEffect(() => {
    if (!open || !room) return;
    const cached = cacheRef.current.get(room.id);
    if (cached && cached.length === room.pendingMemoCount) {
      setActionError(null);
      setFetchState({ status: "SUCCESS", notes: cached });
      return;
    }
    void load(room);
  }, [load, open, room]);

  const complete = (noteId: string) => {
    if (!room || fetchState.status !== "SUCCESS") return;
    const currentRoom = room;
    const currentNotes = fetchState.notes;
    setPendingId(noteId);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await changeRoomNoteStatusAction({ id: noteId, status: "COMPLETED" });
        if (!result.success) {
          setActionError(i18n("roomNotes.inspectionDialog.completionFailed"));
          return;
        }
        const notes = currentNotes.filter((note) => note.id !== noteId);
        cacheRef.current.set(currentRoom.id, notes);
        setFetchState({ status: "SUCCESS", notes });
        onPendingMemoCountChange(currentRoom.id, notes.length);
        router.refresh();
        if (!notes.length) close();
      } catch {
        setActionError(i18n("roomNotes.inspectionDialog.completionFailed"));
      } finally {
        setPendingId(null);
      }
    });
  };

  const formatDate = (note: RoomNoteViewModel) => new Intl.DateTimeFormat(localeTag, {
    timeZone: note.propertyTimeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(note.createdAt));

  const roomNotesHref = room ? `/room-notes?propertyId=${encodeURIComponent(room.propertyId)}&roomId=${encodeURIComponent(room.id)}&status=open` : "/room-notes";

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !pending) close(); }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!pending}>
      {room && <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="size-5 text-red-600 dark:text-red-400" />{i18n("roomNotes.inspectionDialog.title", { room: `${room.propertyName} ${room.name}` })}</DialogTitle>
          <DialogDescription>{i18n("roomNotes.inspectionDialog.description", { count: fetchState.notes.length || room.pendingMemoCount })}</DialogDescription>
        </DialogHeader>

        {actionError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{actionError}</p>}

        {fetchState.status === "LOADING" && <div role="status" className="flex min-h-44 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />{i18n("roomNotes.inspectionDialog.loading")}</div>}

        {fetchState.status === "FAILED" && <div role="alert" className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 text-center">
          <p className="text-sm text-muted-foreground">{i18n("roomNotes.inspectionDialog.loadFailed")}</p>
          <Button type="button" variant="outline" onClick={() => { void load(room); }}><RotateCcw />{i18n("roomNotes.inspectionDialog.retry")}</Button>
        </div>}

        {fetchState.status === "SUCCESS" && <div className="space-y-3">
          {fetchState.notes.map((note) => <article key={note.id} className="space-y-3 rounded-2xl border border-red-200/80 bg-card p-3 shadow-sm dark:border-red-900/70 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Badge variant="outline" className="border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200">{i18n("roomNotes.status.OPEN")}</Badge>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">{note.content}</p>
                <p className="text-xs text-muted-foreground">{i18n("roomNotes.inspectionDialog.authorAndDate", { author: note.authorName, date: formatDate(note) })}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground"><Camera className="size-3.5" />{i18n("roomNotes.inspectionDialog.photoCount", { count: note.photoCount })}</span>
            </div>

            {note.photos.length > 0 && note.cleaningTaskId && <CleaningPhotoUploader taskId={note.cleaningTaskId} initialPhotos={note.photos} readOnly onResult={() => undefined} />}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <Button nativeButton={false} render={<Link href={roomNotesHref} />} type="button" variant="outline" size="sm" className="min-h-10 sm:min-h-8"><ExternalLink />{i18n("roomNotes.inspectionDialog.details")}</Button>
              {canComplete && <Button type="button" size="sm" className="min-h-10 sm:min-h-8" disabled={pending} onClick={() => complete(note.id)}>
                {pendingId === note.id ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}{i18n("roomNotes.actions.complete")}
              </Button>}
            </div>
          </article>)}
        </div>}
      </>}
    </DialogContent>
  </Dialog>;
}
