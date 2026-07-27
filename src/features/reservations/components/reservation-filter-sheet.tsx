"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EMPTY_RESERVATION_FILTERS, type ReservationFilterState } from "../reservation-filter-query";
import { getReservationFilterCount } from "../reservation-filter-count";
import { ReservationFilterFields, type ReservationPropertyOption, type ReservationProviderOption, type ReservationRoomOption } from "./reservation-filter-fields";

export function ReservationFilterSheet({ filters, effectiveDateRange, properties, rooms, providers, onApply, onReset }: {
  filters: ReservationFilterState;
  effectiveDateRange: { from: string; to: string };
  properties: ReservationPropertyOption[];
  rooms: ReservationRoomOption[];
  providers: ReservationProviderOption[];
  onApply: (filters: ReservationFilterState) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const activeCount = getReservationFilterCount(filters);
  const changeOpen = (next: boolean) => { if (next) setDraft(filters); setOpen(next); };
  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger render={<Button type="button" variant="outline" className="relative min-h-11 min-w-[5.25rem] gap-1.5 px-3" aria-label={`예약 필터 열기${activeCount ? `, ${activeCount}개 적용됨` : ""}`} />}>
        <SlidersHorizontal /><span>필터{activeCount > 0 && ` ${activeCount}`}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[90dvh] max-h-[90dvh] gap-0 overflow-hidden p-0" aria-label="예약 필터">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <SheetHeader className="border-b px-4 py-3 text-left"><SheetTitle>필터</SheetTitle><SheetDescription>필터를 고른 뒤 적용하면 예약 목록이 갱신됩니다.</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4"><ReservationFilterFields value={draft} onChange={setDraft} properties={properties} rooms={rooms} providers={providers} effectiveDateRange={effectiveDateRange} /></div>
        <SheetFooter className="grid grid-cols-2 border-t bg-popover px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => { setDraft({ ...EMPTY_RESERVATION_FILTERS, search: filters.search }); onReset(); setOpen(false); }}>초기화</Button>
          <Button type="button" className="min-h-11" onClick={() => { onApply(draft); setOpen(false); }}>필터 적용</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
