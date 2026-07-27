"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { MobileRoomFilters } from "../domain/room-overview-mobile";

const statusOptions: Array<{ value: MobileRoomFilters["status"]; label: string }> = [
  { value: "ALL", label: "모든 상태" },
  { value: "RESERVED", label: "예약" },
  { value: "VACANT", label: "공실" },
  { value: "CHECK_IN_TODAY", label: "체크인" },
  { value: "CHECK_OUT_TODAY", label: "체크아웃" },
  { value: "CLEANING", label: "청소중" },
  { value: "CONFLICT", label: "오버부킹" },
];

const fieldClassName = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

export function RoomStatusFilterSheet({
  filters,
  propertyId,
  properties,
  onApply,
  onReset,
}: {
  filters: MobileRoomFilters;
  propertyId?: string;
  properties: Array<{ id: string; name: string; isActive: boolean }>;
  onApply: (filters: MobileRoomFilters, propertyId?: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [draftPropertyId, setDraftPropertyId] = useState(propertyId ?? "");
  const activeCount = Number(filters.status !== "ALL") + Number(filters.ota !== "ALL") + Number(filters.sync !== "ALL") + Number(Boolean(propertyId));

  const changeOpen = (next: boolean) => {
    if (next) {
      setDraft(filters);
      setDraftPropertyId(propertyId ?? "");
    }
    setOpen(next);
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger render={<Button type="button" variant="outline" size="icon" className="relative min-h-10 min-w-10" aria-label="객실 필터 열기" />}>
        <SlidersHorizontal />
        {activeCount > 0 && <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{activeCount}</span>}
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0" aria-label="객실 필터">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle>객실 필터</SheetTitle>
          <SheetDescription>현재 날짜의 객실 상태와 연결 조건을 선택합니다.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mobile-room-query">객실 검색</Label>
            <input id="mobile-room-query" value={draft.query} onChange={(event) => setDraft((current) => ({ ...current, query: event.target.value }))} placeholder="객실 번호·객실명·숙소명" className={fieldClassName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-room-property">숙소</Label>
            <select id="mobile-room-property" value={draftPropertyId} onChange={(event) => setDraftPropertyId(event.target.value)} className={fieldClassName}>
              <option value="">모든 숙소</option>
              {properties.filter((property) => property.isActive).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-room-status">상태</Label>
            <select id="mobile-room-status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as MobileRoomFilters["status"] }))} className={fieldClassName}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-room-ota">OTA 연결</Label>
            <select id="mobile-room-ota" value={draft.ota} onChange={(event) => setDraft((current) => ({ ...current, ota: event.target.value as MobileRoomFilters["ota"] }))} className={fieldClassName}>
              <option value="ALL">모든 객실</option>
              <option value="CONNECTED">연결됨</option>
              <option value="DISCONNECTED">연결 없음</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-room-sync">동기화 상태</Label>
            <select id="mobile-room-sync" value={draft.sync} onChange={(event) => setDraft((current) => ({ ...current, sync: event.target.value as MobileRoomFilters["sync"] }))} className={fieldClassName}>
              <option value="ALL">모든 상태</option>
              <option value="ERROR">오류 있음</option>
              <option value="NORMAL">오류 없음</option>
            </select>
          </div>
        </div>
        <SheetFooter className="grid grid-cols-2 border-t p-4">
          <Button type="button" variant="outline" onClick={() => { onReset(); setOpen(false); }}>초기화</Button>
          <SheetClose render={<Button type="button" onClick={() => onApply(draft, draftPropertyId || undefined)} />}>적용</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
