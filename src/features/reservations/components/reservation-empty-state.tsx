"use client";

import { CalendarRange, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReservationEmptyState({ hasAnyReservations, hasFilters, onReset }: { hasAnyReservations: boolean; hasFilters: boolean; onReset: () => void }) {
  const filtered = hasAnyReservations && hasFilters;
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-card px-5 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-xl border bg-muted/50"><CalendarRange className="size-5 text-muted-foreground" /></div>
      <h2 className="text-base font-semibold">{filtered ? "조건에 맞는 예약이 없습니다." : "등록된 예약이 없습니다."}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{filtered ? "검색어나 필터 조건을 바꾸어 다시 확인해 보세요." : "OTA 캘린더를 동기화하면 실제 예약이 여기에 표시됩니다."}</p>
      {filtered && <Button type="button" variant="outline" className="mt-5 min-h-11" onClick={onReset}><RotateCcw />필터 초기화</Button>}
    </div>
  );
}
