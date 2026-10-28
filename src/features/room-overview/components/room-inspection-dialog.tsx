"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, History, LoaderCircle, Pencil, Plus, RotateCcw, Save, Trash2, Wrench } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CleaningPhotoUploader } from "@/features/cleaning/components/cleaning-photo-uploader";
import { deleteRoomNoteAction, openRoomInspectionAction, saveRoomNoteProcessingAction, updateRoomNoteAction } from "@/features/room-notes/room-note.actions";
import type { RoomNoteViewModel } from "@/features/room-notes/room-note.types";
import { getRoomInspectionStatus, type RoomInspectionStatus } from "../domain/room-overview";

interface InspectionRoom {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;
  pendingMemoCount: number;
}

type FetchState =
  | { status: "IDLE" | "LOADING" | "FAILED"; notes: RoomNoteViewModel[] }
  | { status: "SUCCESS"; notes: RoomNoteViewModel[] };

const INITIAL_STATE: FetchState = { status: "IDLE", notes: [] };

export function RoomInspectionDialog({
  room,
  open,
  canCreate,
  canUpdate,
  canDelete,
  canComplete,
  refreshKey = 0,
  onCreate,
  onOpenChange,
  onPendingMemoCountChange,
}: {
  room: InspectionRoom | null;
  open: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canComplete: boolean;
  refreshKey?: number;
  onCreate: (room: InspectionRoom) => void;
  onOpenChange: (open: boolean) => void;
  onPendingMemoCountChange: (roomId: string, count: number, inspectionStatus?: RoomInspectionStatus) => void;
}) {
  const i18n = useTranslations();
  const locale = useLocale();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const requestSequenceRef = useRef(0);
  const [fetchState, setFetchState] = useState<FetchState>(INITIAL_STATE);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [processingValues, setProcessingValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = useCallback(() => {
    requestSequenceRef.current += 1;
    setActionError(null);
    setIncludeResolved(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const applyNotes = useCallback((roomId: string, notes: RoomNoteViewModel[]) => {
    setFetchState({ status: "SUCCESS", notes });
    setProcessingValues(Object.fromEntries(notes.map((note) => [note.id, note.resolutionNote])));
    const openNotes = notes.filter((note) => note.status === "OPEN");
    onPendingMemoCountChange(
      roomId,
      openNotes.length,
      getRoomInspectionStatus(openNotes, notes.some((note) => note.status === "COMPLETED")),
    );
  }, [onPendingMemoCountChange]);

  const load = useCallback(async (roomId: string, withResolved: boolean) => {
    const requestSequence = ++requestSequenceRef.current;
    setActionError(null);
    setFetchState({ status: "LOADING", notes: [] });
    try {
      const result = await openRoomInspectionAction({ roomId, includeResolved: withResolved });
      if (requestSequence !== requestSequenceRef.current) return;
      if (!result.success || !result.data) {
        setFetchState({ status: "FAILED", notes: [] });
        return;
      }
      applyNotes(roomId, result.data.notes);
    } catch {
      if (requestSequence === requestSequenceRef.current) setFetchState({ status: "FAILED", notes: [] });
    }
  }, [applyNotes]);

  const activeRoomId = room?.id;
  useEffect(() => {
    if (!open || !activeRoomId) return;
    const timer = window.setTimeout(() => { void load(activeRoomId, includeResolved); }, 0);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, includeResolved, load, open, refreshKey]);

  const formatDate = (value: string | null, timeZone: string) => value ? new Intl.DateTimeFormat(localeTag, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value)) : "-";

  const replaceNote = (noteId: string, patch: Partial<RoomNoteViewModel>) => {
    setFetchState((current) => current.status === "SUCCESS"
      ? { ...current, notes: current.notes.map((note) => note.id === noteId ? { ...note, ...patch } : note) }
      : current);
  };

  const saveProcessing = (note: RoomNoteViewModel, resolved: boolean) => {
    if (!room || fetchState.status !== "SUCCESS") return;
    const targetRoom = room;
    const resolutionNote = processingValues[note.id] ?? "";
    setPendingId(note.id);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await saveRoomNoteProcessingAction({ id: note.id, resolutionNote, resolved });
        if (!result.success || !result.data) {
          setActionError(result.message || "처리내용을 저장하지 못했습니다.");
          return;
        }
        if (!resolved) {
          const nextNotes = fetchState.notes.map((item) => item.id === note.id ? { ...item, ...result.data } : item);
          setFetchState({ status: "SUCCESS", notes: nextNotes });
          const openNotes = nextNotes.filter((item) => item.status === "OPEN");
          onPendingMemoCountChange(
            targetRoom.id,
            openNotes.length,
            getRoomInspectionStatus(openNotes, nextNotes.some((item) => item.status === "COMPLETED")),
          );
          return;
        }
        const nextNotes = includeResolved
          ? fetchState.notes.map((item) => item.id === note.id ? { ...item, ...result.data } : item)
          : fetchState.notes.filter((item) => item.id !== note.id);
        setFetchState({ status: "SUCCESS", notes: nextNotes });
        const nextOpenCount = nextNotes.filter((item) => item.status === "OPEN").length;
        const nextOpenNotes = nextNotes.filter((item) => item.status === "OPEN");
        onPendingMemoCountChange(
          targetRoom.id,
          nextOpenCount,
          getRoomInspectionStatus(nextOpenNotes, nextOpenCount === 0 || nextNotes.some((item) => item.status === "COMPLETED")),
        );
        if (!includeResolved && nextOpenCount === 0) close();
      } catch {
        setActionError("처리내용을 저장하지 못했습니다.");
      } finally {
        setPendingId(null);
      }
    });
  };

  const saveEdit = (note: RoomNoteViewModel) => {
    setPendingId(note.id);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await updateRoomNoteAction({ id: note.id, content: editingContent });
        if (!result.success || !result.data) {
          setActionError(result.message || "메모를 수정하지 못했습니다.");
          return;
        }
        replaceNote(note.id, { content: result.data.content });
        setEditingId(null);
      } finally {
        setPendingId(null);
      }
    });
  };

  const remove = (note: RoomNoteViewModel) => {
    if (!room || !window.confirm("이 객실 메모를 삭제하시겠습니까?")) return;
    const targetRoom = room;
    setPendingId(note.id);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await deleteRoomNoteAction({ id: note.id });
        if (!result.success) {
          setActionError(result.message || "메모를 삭제하지 못했습니다.");
          return;
        }
        const nextNotes = fetchState.notes.filter((item) => item.id !== note.id);
        setFetchState({ status: "SUCCESS", notes: nextNotes });
        const nextOpenCount = nextNotes.filter((item) => item.status === "OPEN").length;
        const nextOpenNotes = nextNotes.filter((item) => item.status === "OPEN");
        onPendingMemoCountChange(
          targetRoom.id,
          nextOpenCount,
          getRoomInspectionStatus(nextOpenNotes, nextNotes.some((item) => item.status === "COMPLETED")),
        );
        if (!includeResolved && nextOpenCount === 0) close();
      } finally {
        setPendingId(null);
      }
    });
  };

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !pending) close(); }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!pending}>
      {room && <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="size-5 text-red-600 dark:text-red-400" />{i18n("roomNotes.inspectionDialog.title", { room: `${room.propertyName} ${room.name}` })}</DialogTitle>
          <DialogDescription>미처리 점검 내용을 확인하고 현장 처리 결과를 기록합니다.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant={includeResolved ? "secondary" : "outline"} size="sm" onClick={() => setIncludeResolved((value) => !value)} disabled={pending}>
            <History />{includeResolved ? "미처리만 보기" : "해결 이력 보기"}
          </Button>
          {canCreate && <Button type="button" size="sm" onClick={() => onCreate(room)}><Plus />메모 추가</Button>}
        </div>

        {actionError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{actionError}</p>}

        {fetchState.status === "LOADING" && <div role="status" className="flex min-h-44 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />{i18n("roomNotes.inspectionDialog.loading")}</div>}

        {fetchState.status === "FAILED" && <div role="alert" className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 text-center">
          <p className="text-sm text-muted-foreground">{i18n("roomNotes.inspectionDialog.loadFailed")}</p>
          <Button type="button" variant="outline" onClick={() => { void load(room.id, includeResolved); }}><RotateCcw />{i18n("roomNotes.inspectionDialog.retry")}</Button>
        </div>}

        {fetchState.status === "SUCCESS" && <div className="space-y-3">
          {!fetchState.notes.length && <p className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">{includeResolved ? "객실 메모 이력이 없습니다." : "미처리 객실 메모가 없습니다."}</p>}
          {fetchState.notes.map((note) => <article key={note.id} className={`space-y-3 rounded-2xl border bg-card p-3 shadow-sm sm:p-4 ${note.status === "OPEN" ? "border-red-200/80 dark:border-red-900/70" : "border-emerald-200/80 opacity-90 dark:border-emerald-900/70"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Badge variant="outline" className={note.status === "OPEN" ? "border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200" : "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"}>{note.status === "OPEN" ? "미처리" : "해결"}</Badge>
                {editingId === note.id ? <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={4} maxLength={1000} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" /> : <p className="whitespace-pre-wrap break-words text-sm leading-6">{note.content}</p>}
                <p className="text-xs text-muted-foreground">등록: {formatDate(note.createdAt, note.propertyTimeZone)} / {note.authorName}</p>
                {note.acknowledgedAt && <p className="text-xs text-muted-foreground">확인: {formatDate(note.acknowledgedAt, note.propertyTimeZone)} / {note.acknowledgedByName ?? "-"}</p>}
                {note.processedAt && <p className="text-xs text-muted-foreground">처리: {formatDate(note.processedAt, note.propertyTimeZone)} / {note.processedByName ?? "-"}</p>}
                {note.completedAt && <p className="text-xs text-emerald-700 dark:text-emerald-300">해결: {formatDate(note.completedAt, note.propertyTimeZone)} / {note.completedByName ?? "-"}</p>}
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground"><Camera className="size-3.5" />{i18n("roomNotes.inspectionDialog.photoCount", { count: note.photoCount })}</span>
            </div>

            {note.photos.length > 0 && note.cleaningTaskId && <CleaningPhotoUploader taskId={note.cleaningTaskId} initialPhotos={note.photos} readOnly onResult={() => undefined} />}
            {note.photos.length > 0 && note.sourceType === "MANUAL" && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {note.photos.map((photo) => photo.url && <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                <Image src={photo.url} alt={photo.originalName} fill sizes="(max-width: 640px) 30vw, 140px" className="object-cover" unoptimized />
              </a>)}
            </div>}

            {note.status === "OPEN" && canComplete && <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <label htmlFor={`room-note-processing-${note.id}`} className="text-xs font-semibold">처리내용</label>
              <textarea id={`room-note-processing-${note.id}`} value={processingValues[note.id] ?? ""} onChange={(event) => setProcessingValues((current) => ({ ...current, [note.id]: event.target.value }))} rows={3} maxLength={2000} disabled={pending} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="현장에서 확인한 내용과 처리 결과를 입력하세요." />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => saveProcessing(note, false)}>{pendingId === note.id ? <LoaderCircle className="animate-spin" /> : <Save />}미해결 저장</Button>
                <Button type="button" size="sm" disabled={pending} onClick={() => saveProcessing(note, true)}>{pendingId === note.id ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}해결 처리</Button>
              </div>
            </div>}

            {note.status === "COMPLETED" && note.resolutionNote && <div className="rounded-xl border bg-muted/20 p-3"><p className="mb-1 text-xs font-semibold">처리내용</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{note.resolutionNote}</p></div>}

            {(canUpdate || canDelete) && note.sourceType === "MANUAL" && <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              {canUpdate && (editingId === note.id
                ? <><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setEditingId(null)}>취소</Button><Button type="button" size="sm" disabled={pending || !editingContent.trim()} onClick={() => saveEdit(note)}><Save />저장</Button></>
                : <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => { setEditingId(note.id); setEditingContent(note.content); }}><Pencil />원본 메모 수정</Button>)}
              {canDelete && <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => remove(note)}><Trash2 />삭제</Button>}
            </div>}
          </article>)}
        </div>}
      </>}
    </DialogContent>
  </Dialog>;
}
