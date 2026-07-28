"use client";import { useTranslations } from "next-intl";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Plus } from "lucide-react";
import type { PropertyOption } from "@/features/properties";
import { createRoomAction } from "../room.actions";
import { calendarUrlField, ROOM_CALENDAR_PROVIDER_CONFIG } from "../room-calendar-draft";
import type { ActionResult } from "@/lib/action-result";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoomCalendarInputRow } from "./room-calendar-input-row";

export function RoomCreateDialog({ properties }: {properties: PropertyOption[];}) {const i18n = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult>(INITIAL_ACTION_RESULT);
  const activeProperties = properties.filter((property) => property.isActive);
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setResult(INITIAL_ACTION_RESULT);
    setOpen(nextOpen);
  };
  const submit = async (formData: FormData) => {
    const actionResult = await createRoomAction(INITIAL_ACTION_RESULT, formData);
    setResult(actionResult);
    if (actionResult.success) {
      setOpen(false);
      router.refresh();
    }
  };
  return <Dialog open={open} onOpenChange={handleOpenChange}><DialogTrigger render={<Button disabled={!activeProperties.length} />}><Plus />{i18n("auto.m0571")}</DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{i18n("auto.m0572")}</DialogTitle><DialogDescription>{i18n("auto.m0573")}</DialogDescription></DialogHeader><form action={submit} className="space-y-5"><section className="space-y-3"><div><h3 className="text-sm font-semibold">{i18n("auto.m0574")}</h3><p className="text-xs text-muted-foreground">{i18n("auto.m0575")}</p></div><div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1.5 sm:col-span-3"><Label htmlFor="new-room-property">{i18n("common.property")}</Label><select id="new-room-property" name="propertyId" defaultValue="" className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" required><option value="" disabled>{i18n("auto.m0576")}</option>{activeProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><FieldError errors={!result.success ? result.fieldErrors?.propertyId : undefined} /></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="new-room-name">{i18n("auto.m0577")}</Label><Input id="new-room-name" name="name" maxLength={100} required /><FieldError errors={!result.success ? result.fieldErrors?.name : undefined} /></div><div className="space-y-1.5"><Label htmlFor="new-room-capacity">{i18n("auto.m0578")}</Label><Input id="new-room-capacity" name="capacity" type="number" min={1} max={100} placeholder={i18n("auto.m0579")} required /><FieldError errors={!result.success ? result.fieldErrors?.capacity : undefined} /></div></div></section><section className="space-y-3 border-t pt-4"><div className="flex items-start gap-2"><CalendarPlus className="mt-0.5 size-4 text-muted-foreground" /><div><h3 className="text-sm font-semibold">{i18n("auto.m0580")}</h3><p className="text-xs text-muted-foreground">{i18n("auto.m0581")}</p></div></div><div className="space-y-2">{ROOM_CALENDAR_PROVIDER_CONFIG.map((item) => <RoomCalendarInputRow key={item.provider} {...item} serverErrors={!result.success ? result.fieldErrors?.[calendarUrlField(item.provider)] : undefined} />)}</div></section><ActionMessage result={result} /><div className="flex justify-end"><SubmitButton>{i18n("auto.m0571")}</SubmitButton></div></form></DialogContent></Dialog>;
}
