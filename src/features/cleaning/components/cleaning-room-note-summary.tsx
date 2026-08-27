"use client";

import { useTranslations } from "next-intl";
import { Camera, MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RoomNoteViewModel } from "@/features/room-notes";
import { getCleaningRoomNotePreview } from "../domain/cleaning-room-notes";

export function CleaningRoomNoteSummary({ notes, onOpen }: {
  notes: readonly RoomNoteViewModel[];
  onOpen: () => void;
}) {
  const t = useTranslations("cleaning.roomNotes");
  if (!notes.length) return null;
  const preview = getCleaningRoomNotePreview(notes);

  return (
    <button
      type="button"
      data-cleaning-room-notes
      className="w-full rounded-xl border bg-muted/20 p-2.5 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t("openLabel", { count: preview.totalCount })}
      onClick={onOpen}
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <MessageSquareText className="size-3.5 text-muted-foreground" />
        {t("title")}
        <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 tabular-nums">{preview.totalCount}</Badge>
      </span>
      <span className="mt-1.5 block space-y-1">
        {preview.items.map((note) => (
          <span key={note.id} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden>•</span>
            <span className="min-w-0 flex-1 truncate">{note.content}</span>
            {note.photoCount > 0 && <span className="flex shrink-0 items-center gap-0.5" aria-label={t("photoCount", { count: note.photoCount })}><Camera className="size-3" />{note.photoCount}</span>}
          </span>
        ))}
      </span>
      {preview.remainingCount > 0 && <span className="mt-1.5 block text-xs font-medium text-foreground/80">{t("more", { count: preview.remainingCount })}</span>}
    </button>
  );
}
