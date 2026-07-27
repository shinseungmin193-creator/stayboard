"use client";

import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ReservationFilterState } from "../reservation-filter-query";
import { applyQuickReservationFilter, type ReservationQuickFilter } from "../reservation-quick-filters";

const QUICK_FILTERS: Array<{ value: ReservationQuickFilter; label: string; description: string }> = [
  { value: "today-check-in", label: "오늘 체크인", description: "오늘 도착 예정 예약" },
  { value: "today-check-out", label: "오늘 체크아웃", description: "오늘 퇴실 예정 예약" },
  { value: "week-check-in", label: "이번 주 체크인", description: "월요일부터 일요일까지" },
  { value: "week-check-out", label: "이번 주 체크아웃", description: "이번 주 퇴실 일정" },
  { value: "month-stays", label: "이번 달 예약", description: "이번 달과 겹치는 숙박" },
  { value: "conflicts", label: "오버부킹만", description: "겹치는 예약 확인" },
];

export function ReservationQuickFilterSheet({ filters, onApply }: { filters: ReservationFilterState; onApply: (filters: ReservationFilterState) => void }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="빠른 필터 열기" />}><Zap /></SheetTrigger>
      <SheetContent side="bottom" className="gap-0 overflow-hidden p-0" aria-label="빠른 예약 필터">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <SheetHeader className="border-b px-4 py-3 text-left"><SheetTitle>빠른 필터</SheetTitle><SheetDescription>자주 쓰는 조건을 한 번에 적용합니다.</SheetDescription></SheetHeader>
        <div className="grid max-h-[60dvh] gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {QUICK_FILTERS.map((item) => (
            <SheetClose key={item.value} render={<button type="button" onClick={() => onApply(applyQuickReservationFilter(filters, item.value))} className="flex min-h-14 w-full items-center justify-between rounded-xl border bg-background px-3 py-2 text-left transition hover:bg-muted" />}>
              <span><strong className="block text-sm">{item.label}</strong><span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span></span><Zap className="size-4 text-muted-foreground" />
            </SheetClose>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
