"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { createRoomNoteAction, type CreatedRoomNoteData } from "../room-note.actions";
import type { RoomNoteOptions } from "../room-note.types";

const INITIAL_RESULT: ActionResult<CreatedRoomNoteData> = { success: true };

export function RoomNoteCreateDialog({ options }: { options: RoomNoteOptions }) {
  const t = useTranslations("roomNotes");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const submitted = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [result, formAction] = useActionState(createRoomNoteAction, INITIAL_RESULT);
  const activeProperties = options.properties.filter((property) => property.isActive && options.rooms.some((room) => room.propertyId === property.id && room.isActive && room.canCreate));
  const activeRooms = options.rooms.filter((room) => room.isActive && room.canCreate && room.propertyId === propertyId);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  useEffect(() => {
    if (!submitted.current || !result.success || !result.message) return;
    submitted.current = false;
    setOpen(false);
    setPropertyId("");
    setRoomId("");
    formRef.current?.reset();
    setNotice(result.message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2400);
    router.refresh();
  }, [result, router]);

  return <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={activeProperties.length === 0} />}><Plus />{t("actions.add")}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("form.title")}</DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={(formData) => { submitted.current = true; formAction(formData); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="room-note-property">{t("columns.property")}</Label>
            <select id="room-note-property" name="propertyId" value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setRoomId(""); }} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm md:h-8" required>
              <option value="" disabled>{t("form.selectProperty")}</option>
              {activeProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <FieldError errors={!result.success ? result.fieldErrors?.propertyId : undefined} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-note-room">{t("columns.room")}</Label>
            <select id="room-note-room" name="roomId" value={roomId} onChange={(event) => setRoomId(event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm md:h-8" disabled={!propertyId} required>
              <option value="" disabled>{t("form.selectRoom")}</option>
              {activeRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
            <FieldError errors={!result.success ? result.fieldErrors?.roomId : undefined} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-note-content">{t("columns.content")}</Label>
            <textarea id="room-note-content" name="content" rows={5} maxLength={1000} className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" placeholder={t("form.contentPlaceholder")} required />
            <FieldError errors={!result.success ? result.fieldErrors?.content : undefined} />
          </div>
          <ActionMessage result={result} />
          <div className="flex justify-end"><SubmitButton disabled={!propertyId || !roomId}>{t("actions.create")}</SubmitButton></div>
        </form>
      </DialogContent>
    </Dialog>
    {notice && <div className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-lg bg-foreground px-4 py-3 text-center text-sm font-medium text-background shadow-lg lg:bottom-6" role="status" aria-live="polite">{notice}</div>}
  </>;
}
