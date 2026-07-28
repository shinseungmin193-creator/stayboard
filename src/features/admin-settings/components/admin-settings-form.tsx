"use client";import { useTranslations } from "next-intl";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanySettingsAction } from "../admin-settings.actions";
import type { CompanySettingsValues } from "../domain/company-settings";

const initialState: ActionResult = { success: false, message: "" };

function ToggleField({ name, label, description, defaultChecked, disabled = false }: {name: string;label: string;description: string;defaultChecked: boolean;disabled?: boolean;}) {
  return <label className="flex items-start justify-between gap-4 rounded-lg border p-3"><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span><input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-1 size-4 accent-primary" /></label>;
}

export function AdminSettingsForm({ companyId, settings }: {companyId: string;settings: CompanySettingsValues;}) {const i18n = useTranslations();
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(async (previousState: ActionResult, formData: FormData) => {
    const result = await updateCompanySettingsAction(previousState, formData);
    if (result.success) setDirty(false);
    return result;
  }, initialState);
  const errors = state.success ? undefined : state.fieldErrors;

  return <form action={formAction} onChange={() => setDirty(true)} className="space-y-4">
    <input type="hidden" name="companyId" value={companyId} />
    <Card><CardHeader><CardTitle className="text-base">{i18n("auto.m0152")}</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2"><div className="space-y-1.5 lg:col-span-2"><Label htmlFor="timezone">{i18n("auto.m0153")}</Label><Input id="timezone" name="timezone" defaultValue={settings.timezone} /><FieldError errors={errors?.timezone} /><p className="text-xs text-muted-foreground">{i18n("auto.m0154")}</p></div><div className="space-y-1.5"><Label htmlFor="defaultCheckInTime">{i18n("auto.m0155")}</Label><Input id="defaultCheckInTime" name="defaultCheckInTime" type="time" defaultValue={settings.defaultCheckInTime} /><FieldError errors={errors?.defaultCheckInTime} /></div><div className="space-y-1.5"><Label htmlFor="defaultCheckOutTime">{i18n("auto.m0156")}</Label><Input id="defaultCheckOutTime" name="defaultCheckOutTime" type="time" defaultValue={settings.defaultCheckOutTime} /><FieldError errors={errors?.defaultCheckOutTime} /></div><div className="space-y-1.5"><Label htmlFor="nextReservationDisplayDays">{i18n("auto.m0157")}</Label><Input id="nextReservationDisplayDays" name="nextReservationDisplayDays" type="number" min={1} max={30} defaultValue={settings.nextReservationDisplayDays} /><FieldError errors={errors?.nextReservationDisplayDays} /></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">{i18n("auto.m0158")}</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2"><ToggleField name="showFutureReservationsAsVacant" label={i18n("auto.m0159")} description={i18n("auto.m0160")} defaultChecked={settings.showFutureReservationsAsVacant} /><ToggleField name="showBlockedAsRoomStatus" label={i18n("auto.m0161")} description={i18n("auto.m0162")} defaultChecked={settings.showBlockedAsRoomStatus} /><ToggleField name="showNextReservationOnVacant" label={i18n("auto.m0163")} description={i18n("auto.m0164")} defaultChecked={settings.showNextReservationOnVacant} /><div className="space-y-1.5 rounded-lg border p-3"><Label htmlFor="guestFallbackMode">{i18n("auto.m0165")}</Label><select id="guestFallbackMode" name="guestFallbackMode" defaultValue={settings.guestFallbackMode} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="PROVIDER">{i18n("auto.m0166")}</option><option value="GENERIC">{i18n("auto.m0167")}</option></select></div><div className="space-y-1.5 rounded-lg border p-3 lg:col-span-2"><Label htmlFor="conflictDisplayLabel">{i18n("conflict.label")}{i18n("auto.m0168")}</Label><Input id="conflictDisplayLabel" name="conflictDisplayLabel" maxLength={20} defaultValue={settings.conflictDisplayLabel} /><FieldError errors={errors?.conflictDisplayLabel} /></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">{i18n("auto.m0169")}</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2"><ToggleField name="cleaningStatusEnabled" label={i18n("auto.m0170")} description={i18n("auto.m0171")} defaultChecked={settings.cleaningStatusEnabled} /><ToggleField name="inspectionStatusEnabled" label={i18n("auto.m0172")} description={i18n("auto.m0173")} defaultChecked={settings.inspectionStatusEnabled} /><ToggleField name="autoMarkCleaningRequired" label={i18n("auto.m0174")} description={i18n("auto.m0175")} defaultChecked={settings.autoMarkCleaningRequired} /></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">{i18n("auto.m0176")}</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2"><ToggleField name="showSyncFailureWarnings" label={i18n("auto.m0177")} description={i18n("auto.m0178")} defaultChecked={settings.showSyncFailureWarnings} /><ToggleField name="showSyncSuccessMessage" label={i18n("auto.m0179")} description={i18n("auto.m0180")} defaultChecked={settings.showSyncSuccessMessage} /><div className="space-y-1.5 rounded-lg border p-3 lg:col-span-2"><Label htmlFor="recentSyncLogLimit">{i18n("auto.m0181")}</Label><Input id="recentSyncLogLimit" name="recentSyncLogLimit" type="number" min={1} max={50} defaultValue={settings.recentSyncLogLimit} /><FieldError errors={errors?.recentSyncLogLimit} /></div></CardContent></Card>
    <div className="sticky bottom-3 flex flex-col gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><ActionMessage result={state} />{dirty && <p className="text-xs font-medium text-amber-600">{i18n("auto.m0182")}</p>}</div><Button type="submit" disabled={pending || !dirty}>{pending ? i18n("auto.m0183") : <><Save />{i18n("auto.m0184")}</>}</Button></div>
  </form>;
}
