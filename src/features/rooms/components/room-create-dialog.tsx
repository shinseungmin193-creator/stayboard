"use client";

import { useActionState } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import type { PropertyOption } from "@/features/properties";
import { createRoomAction } from "../room.actions";
import { calendarUrlField, ROOM_CALENDAR_PROVIDER_CONFIG } from "../room-calendar-draft";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoomCalendarInputRow } from "./room-calendar-input-row";

export function RoomCreateDialog({ properties }: { properties: PropertyOption[] }) {
  const [result, formAction] = useActionState(createRoomAction, INITIAL_ACTION_RESULT);
  const activeProperties = properties.filter((property) => property.isActive);
  return <Dialog><DialogTrigger render={<Button disabled={!activeProperties.length} />}><Plus />객실 등록</DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>새 객실 등록</DialogTitle><DialogDescription>객실 기본정보를 입력하고, 필요한 OTA iCal URL만 연결 테스트 후 함께 등록하세요.</DialogDescription></DialogHeader><form action={formAction} className="space-y-5"><section className="space-y-3"><div><h3 className="text-sm font-semibold">기본 정보</h3><p className="text-xs text-muted-foreground">비활성 숙소에는 새 객실을 등록할 수 없습니다.</p></div><div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1.5 sm:col-span-3"><Label htmlFor="new-room-property">숙소</Label><select id="new-room-property" name="propertyId" defaultValue="" className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" required><option value="" disabled>숙소를 선택하세요</option>{activeProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><FieldError errors={!result.success ? result.fieldErrors?.propertyId : undefined} /></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="new-room-name">객실명</Label><Input id="new-room-name" name="name" maxLength={100} required /><FieldError errors={!result.success ? result.fieldErrors?.name : undefined} /></div><div className="space-y-1.5"><Label htmlFor="new-room-capacity">수용 인원</Label><Input id="new-room-capacity" name="capacity" type="number" min={1} max={100} placeholder="예: 2" required /><FieldError errors={!result.success ? result.fieldErrors?.capacity : undefined} /></div></div></section><section className="space-y-3 border-t pt-4"><div className="flex items-start gap-2"><CalendarPlus className="mt-0.5 size-4 text-muted-foreground" /><div><h3 className="text-sm font-semibold">OTA 캘린더 연결</h3><p className="text-xs text-muted-foreground">URL을 입력한 Provider는 연결 테스트에 성공해야 저장할 수 있습니다. 빈 URL은 등록하지 않습니다.</p></div></div><div className="space-y-2">{ROOM_CALENDAR_PROVIDER_CONFIG.map((item) => <RoomCalendarInputRow key={item.provider} {...item} serverErrors={!result.success ? result.fieldErrors?.[calendarUrlField(item.provider)] : undefined} />)}</div></section><ActionMessage result={result} /><div className="flex justify-end"><SubmitButton>객실 등록</SubmitButton></div></form></DialogContent></Dialog>;
}
