"use client";

import { type FormEvent, useState, useTransition } from "react";
import { CalendarClock, LoaderCircle, Settings2 } from "lucide-react";
import type { PropertyOption } from "@/features/properties";
import type { RoomListItem } from "../room.types";
import { updateRoomWithCalendarSourcesAction, type UpdateRoomWithCalendarSourcesActionResult } from "../room.actions";
import {
  calendarSourceDraftSubmitErrors,
  createInitialCalendarSourceDrafts,
  toCalendarSourceUpdateDrafts,
  type CalendarSourceDraft,
} from "../room-calendar-source-draft";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoomCalendarSourceEditor } from "./room-calendar-source-editor";

const initialResult: UpdateRoomWithCalendarSourcesActionResult = { success: true, message: "" };

export function RoomFormDialog({ properties, room }: { properties: PropertyOption[]; room: RoomListItem }) {
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(room.propertyId);
  const [name, setName] = useState(room.name);
  const [capacity, setCapacity] = useState(String(room.capacity));
  const [drafts, setDrafts] = useState<CalendarSourceDraft[]>(() => createInitialCalendarSourceDrafts(room.calendarSources));
  const [result, setResult] = useState<UpdateRoomWithCalendarSourcesActionResult>(initialResult);
  const [sourceErrors, setSourceErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setPropertyId(room.propertyId);
    setName(room.name);
    setCapacity(String(room.capacity));
    setDrafts(createInitialCalendarSourceDrafts(room.calendarSources));
    setResult(initialResult);
    setSourceErrors({});
  };
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
      setResult({ success: false, message: "URL을 변경하거나 추가한 연결은 테스트 성공 후 저장할 수 있습니다." });
      return;
    }
    setSourceErrors({});
    startTransition(async () => {
      const actionResult = await updateRoomWithCalendarSourcesAction({
        id: room.id,
        propertyId,
        name,
        capacity: Number(capacity),
        sources: toCalendarSourceUpdateDrafts(drafts),
      });
      setResult(actionResult);
      setSourceErrors(actionResult.success ? {} : actionResult.sourceErrors ?? {});
      if (actionResult.success) setOpen(false);
    });
  };

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}><Settings2 />수정</DialogTrigger>
    <DialogContent className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl" showCloseButton={false}>
      <DialogHeader className="border-b px-4 py-3">
        <DialogTitle>객실 수정</DialogTitle>
        <DialogDescription>객실 기본정보와 OTA 캘린더 연결을 관리합니다. iCal URL을 변경한 경우 연결 테스트 후 저장해 주세요.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="contents">
        <div className="min-h-0 space-y-5 overflow-y-auto p-4">
          <section className="space-y-3">
            <div><h3 className="text-sm font-semibold">기본 정보</h3><p className="text-xs text-muted-foreground">숙소, 객실명과 수용 인원을 수정할 수 있습니다.</p></div>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1.2fr_0.6fr]">
              <div className="space-y-1.5"><Label htmlFor={`room-property-${room.id}`}>숙소</Label><select id={`room-property-${room.id}`} value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" required><option value="" disabled>숙소를 선택하세요</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}{property.isActive ? "" : " (비활성)"}</option>)}</select><FieldError errors={!result.success ? result.fieldErrors?.propertyId : undefined} /></div>
              <div className="space-y-1.5"><Label htmlFor={`room-name-${room.id}`}>객실명</Label><Input id={`room-name-${room.id}`} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /><FieldError errors={!result.success ? result.fieldErrors?.name : undefined} /></div>
              <div className="space-y-1.5"><Label htmlFor={`capacity-${room.id}`}>수용 인원</Label><Input id={`capacity-${room.id}`} value={capacity} onChange={(event) => setCapacity(event.target.value)} type="number" min={1} max={100} required /><FieldError errors={!result.success ? result.fieldErrors?.capacity : undefined} /></div>
            </div>
          </section>
          <section className="space-y-3 border-t pt-4">
            <div className="flex items-start gap-2"><CalendarClock className="mt-0.5 size-4 text-muted-foreground" /><div><h3 className="text-sm font-semibold">OTA 캘린더 연결</h3><p className="text-xs text-muted-foreground">기존 URL은 변경하지 않으면 재테스트 없이 저장됩니다. 신규·변경 URL은 서버에서 저장 직전 다시 검증합니다.</p></div></div>
            <RoomCalendarSourceEditor roomName={name} drafts={drafts} onDraftsChange={setDrafts} sourceErrors={sourceErrors} />
          </section>
          <ActionMessage result={result} />
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-4 py-3">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>취소</Button>
          <Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="animate-spin" />저장 중</> : "변경 저장"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
