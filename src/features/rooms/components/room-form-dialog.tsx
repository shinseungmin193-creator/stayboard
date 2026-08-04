"use client";import { useTranslations } from "next-intl";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { CalendarClock, LoaderCircle, Settings2 } from "lucide-react";
import type { PropertyOption } from "@/features/properties";
import type { RoomListItem } from "../room.types";
import { updateRoomWithCalendarSourcesAction, type UpdateRoomWithCalendarSourcesActionResult } from "../room.actions";
import {
  calendarSourceDraftSubmitErrors,
  createInitialCalendarSourceDrafts,
  removeExistingCalendarSourceDraft,
  toCalendarSourceUpdateDrafts,
  type CalendarSourceDraft } from
"../room-calendar-source-draft";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoomCalendarSourceEditor } from "./room-calendar-source-editor";

const initialResult: UpdateRoomWithCalendarSourcesActionResult = { success: true, message: "" };

export function RoomFormDialog({ properties, room, canManageCalendarSources }: {properties: PropertyOption[];room: RoomListItem;canManageCalendarSources: boolean;}) {const i18n = useTranslations();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(room.propertyId);
  const [name, setName] = useState(room.name);
  const [capacity, setCapacity] = useState(String(room.capacity));
  const [drafts, setDrafts] = useState<CalendarSourceDraft[]>(() => createInitialCalendarSourceDrafts(room.calendarSources));
  const [result, setResult] = useState<UpdateRoomWithCalendarSourcesActionResult>(initialResult);
  const [sourceErrors, setSourceErrors] = useState<Record<string, string[]>>({});
  const [deletedSourceIds, setDeletedSourceIds] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState<{message: string;success: boolean;} | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setPropertyId(room.propertyId);
    setName(room.name);
    setCapacity(String(room.capacity));
    setDrafts(createInitialCalendarSourceDrafts(room.calendarSources.filter((source) => !deletedSourceIds.has(source.id))));
    setResult(initialResult);
    setSourceErrors({});
  };
  const handleSourceDeleted = (calendarSourceId: string, message: string) => {
    setDeletedSourceIds((current) => new Set(current).add(calendarSourceId));
    setDrafts((current) => removeExistingCalendarSourceDraft(current, calendarSourceId));
    setNotice({ message, success: true });
  };
  const handleNotice = (message: string, success: boolean) => setNotice({ message, success });
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) reset();
    setOpen(nextOpen);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const clientSourceErrors = calendarSourceDraftSubmitErrors(drafts);
    if (Object.keys(clientSourceErrors).length) {
      setSourceErrors(clientSourceErrors);
      setResult({ success: false, message: i18n("auto.m0582") });
      return;
    }
    setSourceErrors({});
    startTransition(async () => {
      const actionResult = await updateRoomWithCalendarSourcesAction({
        id: room.id,
        propertyId,
        name,
        capacity: Number(capacity),
        sources: toCalendarSourceUpdateDrafts(drafts)
      });
      setResult(actionResult);
      setSourceErrors(actionResult.success ? {} : actionResult.sourceErrors ?? {});
      if (actionResult.success) setOpen(false);
    });
  };

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}><Settings2 />{i18n("common.edit")}</DialogTrigger>
    <DialogContent className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl" showCloseButton={false}>
      <DialogHeader className="border-b px-4 py-3">
        <DialogTitle>{i18n("auto.m0583")}</DialogTitle>
        <DialogDescription>{i18n("auto.m0584")}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="contents">
        <div className="min-h-0 space-y-5 overflow-y-auto p-4">
          <section className="space-y-3">
            <div><h3 className="text-sm font-semibold">{i18n("auto.m0574")}</h3><p className="text-xs text-muted-foreground">{i18n("auto.m0585")}</p></div>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1.2fr_0.6fr]">
              <div className="space-y-1.5"><Label htmlFor={`room-property-${room.id}`}>{i18n("common.property")}</Label><select id={`room-property-${room.id}`} value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" required><option value="" disabled>{i18n("auto.m0576")}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}{property.isActive ? "" : i18n("auto.m0287")}</option>)}</select><FieldError errors={!result.success ? result.fieldErrors?.propertyId : undefined} /></div>
              <div className="space-y-1.5"><Label htmlFor={`room-name-${room.id}`}>{i18n("auto.m0577")}</Label><Input id={`room-name-${room.id}`} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /><FieldError errors={!result.success ? result.fieldErrors?.name : undefined} /></div>
              <div className="space-y-1.5"><Label htmlFor={`capacity-${room.id}`}>{i18n("auto.m0578")}</Label><Input id={`capacity-${room.id}`} value={capacity} onChange={(event) => setCapacity(event.target.value)} type="number" min={1} max={100} required /><FieldError errors={!result.success ? result.fieldErrors?.capacity : undefined} /></div>
            </div>
          </section>
          <section className="space-y-3 border-t pt-4">
            <div className="flex items-start gap-2"><CalendarClock className="mt-0.5 size-4 text-muted-foreground" /><div><h3 className="text-sm font-semibold">{i18n("auto.m0580")}</h3><p className="text-xs text-muted-foreground">{i18n("auto.m0586")}</p></div></div>
            <RoomCalendarSourceEditor roomName={name} drafts={drafts} onDraftsChange={setDrafts} onSourceDeleted={handleSourceDeleted} onNotice={handleNotice} canManageCalendarSources={canManageCalendarSources} sourceErrors={sourceErrors} />
          </section>
          <ActionMessage result={result} />
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-4 py-3">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>{i18n("common.cancel")}</Button>
          <Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="animate-spin" />{i18n("auto.m0587")}</> : i18n("auto.m0184")}</Button>
        </div>
      </form>
    </DialogContent>
    {notice && <div role={notice.success ? "status" : "alert"} aria-live="polite" className={`fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[70] max-w-[calc(100vw-2rem)] rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg ${notice.success ? "border-emerald-500/30" : "border-destructive/40 text-destructive"}`}>{notice.message}</div>}
  </Dialog>;
}
