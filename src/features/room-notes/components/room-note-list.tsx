"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type KeyboardEvent, type MouseEvent } from "react";
import { Camera, CheckCircle2, ExternalLink, LoaderCircle, MessageSquareText, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CleaningPhotoUploader } from "@/features/cleaning/components/cleaning-photo-uploader";
import { changeRoomNoteStatusAction, deleteRoomNoteAction } from "../room-note.actions";
import type { RoomNoteViewModel } from "../room-note.types";

function PhotoCount({ count }: { count: number }) {
  if (!count) return null;
  return <Badge variant="outline" className="ml-2 align-middle"><Camera />{count}</Badge>;
}

export function RoomNoteList({ notes, canComplete, canDelete }: {
  notes: RoomNoteViewModel[];
  canComplete: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("roomNotes");
  const locale = useLocale();
  const router = useRouter();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const [selected, setSelected] = useState<RoomNoteViewModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoomNoteViewModel | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const formatDateValue = (value: string, timeZone: string) => new Intl.DateTimeFormat(localeTag, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
  const formatDate = (note: RoomNoteViewModel) => formatDateValue(note.createdAt, note.propertyTimeZone);
  const openFromKeyboard = (event: KeyboardEvent, note: RoomNoteViewModel) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(note); }
  };
  const stop = (event: MouseEvent) => event.stopPropagation();

  const changeStatus = (note: RoomNoteViewModel) => {
    setPendingId(note.id);
    setNotice(null);
    startTransition(async () => {
      const result = await changeRoomNoteStatusAction({ id: note.id, status: note.status === "OPEN" ? "COMPLETED" : "OPEN" });
      setPendingId(null);
      if (!result.success) {
        setNotice({ message: result.message || t("messages.statusFailed"), error: true });
        return;
      }
      setSelected(null);
      setNotice({ message: result.message ?? "", error: false });
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setPendingId(target.id);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteRoomNoteAction({ id: target.id });
      setPendingId(null);
      if (!result.success) {
        setNotice({ message: result.message || t("messages.deleteFailed"), error: true });
        return;
      }
      setDeleteTarget(null);
      setSelected(null);
      setNotice({ message: result.message ?? "", error: false });
      router.refresh();
    });
  };

  const statusBadge = (note: RoomNoteViewModel) => (
    <Badge variant={note.status === "OPEN" ? "secondary" : "outline"}>{t(`status.${note.status}`)}</Badge>
  );
  const actions = (note: RoomNoteViewModel, compact = false) => (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "justify-end" : ""}`} onClick={stop} onKeyDown={(event) => event.stopPropagation()}>
      {canComplete && <Button type="button" size="sm" variant="outline" className="min-h-10 md:min-h-8" disabled={pending} onClick={() => changeStatus(note)}>
        {pending && pendingId === note.id ? <LoaderCircle className="animate-spin" /> : note.status === "OPEN" ? <CheckCircle2 /> : <RotateCcw />}
        {t(note.status === "OPEN" ? "actions.complete" : "actions.reopen")}
      </Button>}
      {canDelete && <Button type="button" size="sm" variant="outline" className="min-h-10 text-destructive hover:text-destructive md:min-h-8" disabled={pending} onClick={() => { setSelected(null); setDeleteTarget(note); }}>
        <Trash2 />{t("actions.delete")}
      </Button>}
    </div>
  );

  return <>
    {!notes.length ? <Card><CardContent className="py-14 text-center"><MessageSquareText className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t("empty")}</p></CardContent></Card> : <>
      <Card className="hidden overflow-hidden py-0 md:block">
        <Table>
          <TableHeader><TableRow><TableHead>{t("columns.status")}</TableHead><TableHead>{t("columns.property")}</TableHead><TableHead>{t("columns.room")}</TableHead><TableHead className="w-full">{t("columns.content")}</TableHead><TableHead>{t("columns.author")}</TableHead><TableHead>{t("columns.createdAt")}</TableHead><TableHead className="text-right">{t("columns.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>{notes.map((note) => <TableRow key={note.id} role="button" tabIndex={0} className={`cursor-pointer ${note.status === "COMPLETED" ? "bg-muted/35 text-muted-foreground" : ""}`} onClick={() => setSelected(note)} onKeyDown={(event) => openFromKeyboard(event, note)}>
            <TableCell>{statusBadge(note)}</TableCell><TableCell>{note.propertyName}</TableCell><TableCell className="font-medium">{note.roomName}</TableCell><TableCell className="max-w-xl whitespace-normal"><span className="line-clamp-2">{note.content}</span><PhotoCount count={note.photoCount} /></TableCell><TableCell>{note.authorName}</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(note)}</TableCell><TableCell>{actions(note, true)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </Card>
      <div className="space-y-2 md:hidden">{notes.map((note) => <div key={note.id} role="button" tabIndex={0} onClick={() => setSelected(note)} onKeyDown={(event) => openFromKeyboard(event, note)} className={`w-full rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/40 ${note.status === "COMPLETED" ? "bg-muted/35 text-muted-foreground" : ""}`}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{note.propertyName} · {note.roomName}</p>{statusBadge(note)}</div><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{note.content}</p></div><PhotoCount count={note.photoCount} /></div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground"><span className="truncate">{note.authorName}</span><time className="shrink-0">{formatDate(note)}</time></div>
        <div className="mt-3 border-t pt-3">{actions(note)}</div>
      </div>)}</div>
    </>}

    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {selected && <>
          <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{selected.propertyName} · {selected.roomName}{statusBadge(selected)}</DialogTitle><DialogDescription>{t("details.description")}</DialogDescription></DialogHeader>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 rounded-xl border p-4 text-sm"><dt className="text-muted-foreground">{t("columns.author")}</dt><dd>{selected.authorName}</dd><dt className="text-muted-foreground">{t("columns.createdAt")}</dt><dd>{formatDate(selected)}</dd><dt className="text-muted-foreground">{t("details.source")}</dt><dd><Badge variant="secondary">{t(`source.${selected.sourceType}`)}</Badge></dd>{selected.status === "COMPLETED" && <><dt className="text-muted-foreground">{t("details.completedBy")}</dt><dd>{selected.completedByName ?? "-"}</dd><dt className="text-muted-foreground">{t("details.completedAt")}</dt><dd>{selected.completedAt ? formatDateValue(selected.completedAt, selected.propertyTimeZone) : "-"}</dd></>}</dl>
          <section className="space-y-2 rounded-xl border p-4"><h3 className="text-sm font-semibold">{t("columns.content")}</h3><p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{selected.content}</p></section>
          <section className="space-y-3 rounded-xl border p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4" />{t("details.photos", { count: selected.photoCount })}</h3>{selected.photos.length ? <CleaningPhotoUploader taskId={selected.cleaningTaskId!} initialPhotos={selected.photos} readOnly onResult={() => undefined} /> : <p className="py-3 text-center text-sm text-muted-foreground">{t("details.noPhotos")}</p>}</section>
          <DialogFooter className="flex-row flex-wrap justify-end">
            {selected.cleaningTaskId && <Button nativeButton={false} render={<Link href={`/cleaning?roomId=${encodeURIComponent(selected.roomId)}${selected.cleaningDate ? `&date=${encodeURIComponent(selected.cleaningDate)}` : ""}`} />} variant="outline"><ExternalLink />{t("actions.openCleaning")}</Button>}
            {actions(selected)}
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pending) setDeleteTarget(null); }}>
      <DialogContent role="alertdialog" showCloseButton={!pending} className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t("delete.title")}</DialogTitle><DialogDescription>{t("delete.description")}</DialogDescription></DialogHeader>
        {deleteTarget && <p className="rounded-lg border bg-muted/40 p-3 text-sm font-medium">{deleteTarget.propertyName} · {deleteTarget.roomName}<span className="mt-1 block line-clamp-2 font-normal text-muted-foreground">{deleteTarget.content}</span></p>}
        {deleteTarget?.sourceType === "CLEANING" && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">{t("delete.cleaningPreserved")}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteTarget(null)}>{t("actions.cancel")}</Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={confirmDelete}>{pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}{t("actions.delete")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {notice && <div className={`fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-sm rounded-lg px-4 py-3 text-center text-sm font-medium shadow-lg lg:bottom-6 ${notice.error ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background"}`} role={notice.error ? "alert" : "status"} aria-live="polite">{notice.message}</div>}
  </>;
}
