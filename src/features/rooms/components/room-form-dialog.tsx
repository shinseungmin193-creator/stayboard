"use client";
import { useActionState } from "react";
import { Plus, Settings2 } from "lucide-react";
import type { PropertyOption } from "@/features/properties";
import type { RoomListItem } from "../room.types";
import { createRoomAction, updateRoomAction } from "../room.actions";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RoomFormDialog({ properties, room }: { properties: PropertyOption[]; room?: RoomListItem }) {
  const [result, formAction] = useActionState(room ? updateRoomAction : createRoomAction, INITIAL_ACTION_RESULT);
  const activeProperties = properties.filter((property) => property.isActive);
  const selectable = room ? properties : activeProperties;
  return <Dialog><DialogTrigger render={<Button variant={room ? "outline" : "default"} size={room ? "sm" : "default"} disabled={!room && !activeProperties.length} />}>{room ? <><Settings2 />수정</> : <><Plus />객실 등록</>}</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{room ? "객실 수정" : "새 객실 등록"}</DialogTitle><DialogDescription>비활성 숙소에는 새 객실을 등록할 수 없습니다. 수용 인원과 정렬 순서는 직접 입력해 주세요.</DialogDescription></DialogHeader><form action={formAction} className="space-y-4">{room && <input type="hidden" name="id" value={room.id} />}<div className="space-y-1.5"><Label htmlFor={`room-property-${room?.id ?? "new"}`}>숙소</Label><select id={`room-property-${room?.id ?? "new"}`} name="propertyId" defaultValue={room?.propertyId ?? ""} className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" required><option value="" disabled>숙소를 선택하세요</option>{selectable.map((property) => <option key={property.id} value={property.id}>{property.name}{property.isActive ? "" : " (비활성)"}</option>)}</select><FieldError errors={!result.success ? result.fieldErrors?.propertyId : undefined} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor={`room-name-${room?.id ?? "new"}`}>객실명</Label><Input id={`room-name-${room?.id ?? "new"}`} name="name" defaultValue={room?.name} maxLength={100} required /><FieldError errors={!result.success ? result.fieldErrors?.name : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`room-code-${room?.id ?? "new"}`}>객실 코드</Label><Input id={`room-code-${room?.id ?? "new"}`} name="code" defaultValue={room?.code} maxLength={50} required /><FieldError errors={!result.success ? result.fieldErrors?.code : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`capacity-${room?.id ?? "new"}`}>수용 인원</Label><Input id={`capacity-${room?.id ?? "new"}`} name="capacity" type="number" min={1} max={100} defaultValue={room?.capacity} placeholder="직접 입력" required /><FieldError errors={!result.success ? result.fieldErrors?.capacity : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`sort-${room?.id ?? "new"}`}>정렬 순서</Label><Input id={`sort-${room?.id ?? "new"}`} name="sortOrder" type="number" min={0} max={100000} defaultValue={room?.sortOrder} placeholder="예: 303" required /><FieldError errors={!result.success ? result.fieldErrors?.sortOrder : undefined} /></div></div><ActionMessage result={result} /><div className="flex justify-end"><SubmitButton>{room ? "변경 저장" : "객실 등록"}</SubmitButton></div></form></DialogContent></Dialog>;
}
