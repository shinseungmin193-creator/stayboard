"use client";

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
import { RESERVATION_CONFLICT_UI } from "@/features/reservation-conflicts/reservation-conflict.labels";

const initialState: ActionResult = { success: false, message: "" };

function ToggleField({ name, label, description, defaultChecked, disabled = false }: { name: string; label: string; description: string; defaultChecked: boolean; disabled?: boolean }) {
  return <label className="flex items-start justify-between gap-4 rounded-lg border p-3"><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span><input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-1 size-4 accent-primary" /></label>;
}

export function AdminSettingsForm({ companyId, settings }: { companyId: string; settings: CompanySettingsValues }) {
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(async (previousState: ActionResult, formData: FormData) => {
    const result = await updateCompanySettingsAction(previousState, formData);
    if (result.success) setDirty(false);
    return result;
  }, initialState);
  const errors = state.success ? undefined : state.fieldErrors;

  return <form action={formAction} onChange={() => setDirty(true)} className="space-y-4">
    <input type="hidden" name="companyId" value={companyId} />
    <Card><CardHeader><CardTitle className="text-base">기본 운영</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2"><div className="space-y-1.5 lg:col-span-2"><Label htmlFor="timezone">시간대</Label><Input id="timezone" name="timezone" defaultValue={settings.timezone} /><FieldError errors={errors?.timezone} /><p className="text-xs text-muted-foreground">IANA Timezone 형식으로 저장합니다.</p></div><div className="space-y-1.5"><Label htmlFor="defaultCheckInTime">기본 체크인 시간</Label><Input id="defaultCheckInTime" name="defaultCheckInTime" type="time" defaultValue={settings.defaultCheckInTime} /><FieldError errors={errors?.defaultCheckInTime} /></div><div className="space-y-1.5"><Label htmlFor="defaultCheckOutTime">기본 체크아웃 시간</Label><Input id="defaultCheckOutTime" name="defaultCheckOutTime" type="time" defaultValue={settings.defaultCheckOutTime} /><FieldError errors={errors?.defaultCheckOutTime} /></div><div className="space-y-1.5"><Label htmlFor="nextReservationDisplayDays">다음 예약 표시 기간</Label><Input id="nextReservationDisplayDays" name="nextReservationDisplayDays" type="number" min={1} max={30} defaultValue={settings.nextReservationDisplayDays} /><FieldError errors={errors?.nextReservationDisplayDays} /></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">객실 현황 정책</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2"><ToggleField name="showFutureReservationsAsVacant" label="미래 예약만 있는 객실은 공실로 표시" description="현재 투숙 예약이 없으면 공실 상태를 유지합니다." defaultChecked={settings.showFutureReservationsAsVacant} /><ToggleField name="showBlockedAsRoomStatus" label="BLOCKED를 객실 상태에 포함" description="기본값은 꺼짐이며 BLOCKED는 객실 투숙 상태에서 제외합니다." defaultChecked={settings.showBlockedAsRoomStatus} /><ToggleField name="showNextReservationOnVacant" label="공실 카드에 다음 예약 표시" description="설정한 표시 기간 안의 다음 예약을 카드에 표시합니다." defaultChecked={settings.showNextReservationOnVacant} /><div className="space-y-1.5 rounded-lg border p-3"><Label htmlFor="guestFallbackMode">Guest 이름이 없을 때</Label><select id="guestFallbackMode" name="guestFallbackMode" defaultValue={settings.guestFallbackMode} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="PROVIDER">Provider 이름</option><option value="GENERIC">게스트 정보 없음</option></select></div><div className="space-y-1.5 rounded-lg border p-3 lg:col-span-2"><Label htmlFor="conflictDisplayLabel">{RESERVATION_CONFLICT_UI.label} 표시명</Label><Input id="conflictDisplayLabel" name="conflictDisplayLabel" maxLength={20} defaultValue={settings.conflictDisplayLabel} /><FieldError errors={errors?.conflictDisplayLabel} /></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">객실 작업 상태</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2"><ToggleField name="cleaningStatusEnabled" label="청소 필요 상태 사용" description="객실 운영 상태 메뉴에서 청소 필요를 사용할 수 있습니다." defaultChecked={settings.cleaningStatusEnabled} /><ToggleField name="inspectionStatusEnabled" label="점검 필요 상태 사용" description="객실 운영 상태 메뉴에서 점검 필요를 사용할 수 있습니다." defaultChecked={settings.inspectionStatusEnabled} /><ToggleField name="autoMarkCleaningRequired" label="체크아웃 후 청소 필요 자동 설정" description="기반 설정만 저장합니다. Scheduler가 연결되기 전에는 자동 실행되지 않습니다." defaultChecked={settings.autoMarkCleaningRequired} /></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">동기화 표시</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2"><ToggleField name="showSyncFailureWarnings" label="최근 동기화 실패 경고 표시" description="객실 카드에서 실패 또는 지연 상태를 표시합니다." defaultChecked={settings.showSyncFailureWarnings} /><ToggleField name="showSyncSuccessMessage" label="동기화 성공 메시지 표시" description="정상 동기화 상태 문구를 화면에 표시합니다." defaultChecked={settings.showSyncSuccessMessage} /><div className="space-y-1.5 rounded-lg border p-3 lg:col-span-2"><Label htmlFor="recentSyncLogLimit">최근 SyncLog 표시 개수</Label><Input id="recentSyncLogLimit" name="recentSyncLogLimit" type="number" min={1} max={50} defaultValue={settings.recentSyncLogLimit} /><FieldError errors={errors?.recentSyncLogLimit} /></div></CardContent></Card>
    <div className="sticky bottom-3 flex flex-col gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><ActionMessage result={state} />{dirty && <p className="text-xs font-medium text-amber-600">저장하지 않은 변경 사항이 있습니다.</p>}</div><Button type="submit" disabled={pending || !dirty}>{pending ? "저장 중..." : <><Save />변경 저장</>}</Button></div>
  </form>;
}
