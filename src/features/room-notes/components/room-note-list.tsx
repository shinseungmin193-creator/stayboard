"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Camera, ExternalLink, MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CleaningPhotoUploader } from "@/features/cleaning/components/cleaning-photo-uploader";
import type { RoomNoteViewModel } from "../room-note.types";

function PhotoCount({ count }: { count: number }) {
  if (!count) return null;
  return <Badge variant="outline" className="ml-2 align-middle"><Camera />{count}</Badge>;
}

export function RoomNoteList({ notes }: { notes: RoomNoteViewModel[] }) {
  const t = useTranslations("roomNotes");
  const locale = useLocale();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const [selected, setSelected] = useState<RoomNoteViewModel | null>(null);
  const formatDate = (note: RoomNoteViewModel) => new Intl.DateTimeFormat(localeTag, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: note.propertyTimeZone,
  }).format(new Date(note.createdAt));
  const openFromKeyboard = (event: React.KeyboardEvent, note: RoomNoteViewModel) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(note); }
  };

  if (!notes.length) return <Card><CardContent className="py-14 text-center"><MessageSquareText className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t("empty")}</p></CardContent></Card>;
  return <>
    <Card className="hidden overflow-hidden py-0 md:block">
      <Table>
        <TableHeader><TableRow><TableHead>{t("columns.property")}</TableHead><TableHead>{t("columns.room")}</TableHead><TableHead className="w-full">{t("columns.content")}</TableHead><TableHead>{t("columns.author")}</TableHead><TableHead>{t("columns.createdAt")}</TableHead></TableRow></TableHeader>
        <TableBody>{notes.map((note) => <TableRow key={note.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => setSelected(note)} onKeyDown={(event) => openFromKeyboard(event, note)}><TableCell>{note.propertyName}</TableCell><TableCell className="font-medium">{note.roomName}</TableCell><TableCell className="max-w-xl whitespace-normal"><span className="line-clamp-2">{note.content}</span><PhotoCount count={note.photoCount} /></TableCell><TableCell>{note.authorName}</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(note)}</TableCell></TableRow>)}</TableBody>
      </Table>
    </Card>
    <div className="space-y-2 md:hidden">{notes.map((note) => <button key={note.id} type="button" onClick={() => setSelected(note)} className="w-full rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{note.propertyName} · {note.roomName}</p><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{note.content}</p></div><PhotoCount count={note.photoCount} /></div><div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground"><span className="truncate">{note.authorName}</span><time className="shrink-0">{formatDate(note)}</time></div></button>)}</div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="sm:max-w-2xl">
        {selected && <>
          <DialogHeader><DialogTitle>{selected.propertyName} · {selected.roomName}</DialogTitle><DialogDescription>{t("details.description")}</DialogDescription></DialogHeader>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 rounded-xl border p-4 text-sm"><dt className="text-muted-foreground">{t("columns.author")}</dt><dd>{selected.authorName}</dd><dt className="text-muted-foreground">{t("columns.createdAt")}</dt><dd>{formatDate(selected)}</dd><dt className="text-muted-foreground">{t("details.source")}</dt><dd><Badge variant="secondary">{t(`source.${selected.sourceType}`)}</Badge></dd></dl>
          <section className="space-y-2 rounded-xl border p-4"><h3 className="text-sm font-semibold">{t("columns.content")}</h3><p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{selected.content}</p></section>
          <section className="space-y-3 rounded-xl border p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4" />{t("details.photos", { count: selected.photoCount })}</h3>{selected.photos.length ? <CleaningPhotoUploader taskId={selected.cleaningTaskId!} initialPhotos={selected.photos} readOnly onResult={() => undefined} /> : <p className="py-3 text-center text-sm text-muted-foreground">{t("details.noPhotos")}</p>}</section>
          {selected.cleaningTaskId && <div className="flex justify-end"><Button nativeButton={false} render={<Link href={`/cleaning?roomId=${encodeURIComponent(selected.roomId)}${selected.cleaningDate ? `&date=${encodeURIComponent(selected.cleaningDate)}` : ""}`} />} variant="outline"><ExternalLink />{t("actions.openCleaning")}</Button></div>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
