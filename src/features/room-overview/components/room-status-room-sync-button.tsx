"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncSelectedRoomCalendarSourcesAction } from "@/features/calendar-sync/calendar-sync.actions";
import { cn } from "@/lib/utils";

export function RoomStatusRoomSyncButton({ roomIds, label = "수동 동기화", className }: { roomIds: string[]; label?: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null);

  const synchronize = () => {
    if (pending || roomIds.length === 0) return;
    setNotice(null);
    startTransition(async () => {
      const result = await syncSelectedRoomCalendarSourcesAction({ roomIds });
      if (!result.success) {
        setNotice({ success: false, message: result.message });
        return;
      }
      const data = result.data;
      const applied = (data?.createdReservations ?? 0) + (data?.updatedReservations ?? 0);
      setNotice({
        success: true,
        message: data?.totalSources
          ? `동기화 완료: 성공 ${data.successCount}개 · 실패 ${data.failureCount}개 · 예약 ${applied}건 반영`
          : "활성 캘린더 연결이 없습니다.",
      });
      router.refresh();
    });
  };

  return <>
    <Button type="button" variant="outline" size="sm" className={className} disabled={pending || roomIds.length === 0} onClick={synchronize}><RefreshCw className={cn(pending && "animate-spin")} />{pending ? "동기화 중..." : label}</Button>
    {notice && <div role={notice.success ? "status" : "alert"} aria-live="polite" className={cn("fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[60] rounded-lg border bg-card px-3 py-2.5 text-xs shadow-lg", notice.success ? "border-emerald-500/40" : "border-destructive/40 text-destructive")}>{notice.message}</div>}
  </>;
}

