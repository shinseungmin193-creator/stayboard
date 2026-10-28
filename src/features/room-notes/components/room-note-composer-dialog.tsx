"use client";

import { useState, useTransition } from "react";
import { Camera, LoaderCircle, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CLEANING_PHOTO_ACCEPT, isSupportedCleaningPhotoSelection, MAX_CLEANING_PHOTO_SIZE } from "@/features/cleaning/domain/cleaning-photo-validation";
import { withBasePath } from "@/lib/base-path";
import { createClientOperationId } from "@/lib/client-operation-id";
import { createRoomNoteInlineAction } from "../room-note.actions";

export interface RoomNoteComposerRoom {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;
}

export function RoomNoteComposerDialog({ room, open, onOpenChange, onCreated }: {
  room: RoomNoteComposerRoom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (roomId: string) => void;
}) {
  const t = useTranslations("roomNotes");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      setContent("");
      setError(null);
      setPhotos([]);
    }
    onOpenChange(nextOpen);
  };

  const submit = () => {
    if (!room || !content.trim()) return;
    const target = room;
    setError(null);
    startTransition(async () => {
      const result = await createRoomNoteInlineAction({ propertyId: target.propertyId, roomId: target.id, content });
      if (!result.success || !result.data) {
        setError(result.message || t("messages.invalid"));
        return;
      }
      let photoUploadFailed = false;
      for (const photo of photos) {
        const body = new FormData();
        body.set("photo", photo);
        const response = await fetch(withBasePath(`/api/room-notes/${encodeURIComponent(result.data.id)}/photos`), {
          method: "POST",
          headers: { "X-Room-Note-Upload-Id": createClientOperationId("room-note-photo") },
          body,
        });
        if (!response.ok) photoUploadFailed = true;
      }
      onCreated(target.id);
      if (photoUploadFailed) {
        setContent("");
        setPhotos([]);
        setError("메모는 등록했지만 일부 사진을 업로드하지 못했습니다. 메모를 다시 만들지 말고 창을 닫은 뒤 확인해 주세요.");
        return;
      }
      changeOpen(false);
    });
  };

  return <Dialog open={open} onOpenChange={(next) => { if (!pending) changeOpen(next); }}>
    <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Plus className="size-5" />{t("form.title")}</DialogTitle>
        <DialogDescription>{room ? `${room.propertyName} ${room.name}` : t("form.description")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="room-overview-note-content">{t("columns.content")}</Label>
        <textarea
          id="room-overview-note-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={6}
          maxLength={1000}
          disabled={pending}
          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          placeholder={t("form.contentPlaceholder")}
          autoFocus
        />
        <p className="text-right text-xs text-muted-foreground">{content.length}/1000</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="room-overview-note-photos">사진 (선택)</Label>
        <input
          id="room-overview-note-photos"
          type="file"
          accept={CLEANING_PHOTO_ACCEPT}
          multiple
          disabled={pending}
          className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            const valid = selected.filter((file) => file.size <= MAX_CLEANING_PHOTO_SIZE && isSupportedCleaningPhotoSelection({ declaredMimeType: file.type, fileName: file.name }));
            if (selected.length > 12 || valid.length !== selected.length) {
              setError(selected.length > 12 ? "사진은 최대 12장까지 등록할 수 있습니다." : "지원하지 않는 사진 형식이거나 용량이 너무 큽니다.");
              event.target.value = "";
              return;
            }
            setError(null);
            setPhotos(valid);
          }}
        />
        {photos.length > 0 && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Camera className="size-3.5" />사진 {photos.length}장 선택됨</p>}
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>{t("actions.cancel")}</Button>
        <Button type="button" disabled={pending || !content.trim()} onClick={submit}>{pending ? <LoaderCircle className="animate-spin" /> : <Plus />}{t("actions.create")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
