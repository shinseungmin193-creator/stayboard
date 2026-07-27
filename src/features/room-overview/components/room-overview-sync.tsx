"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncRoomOverviewCalendarSourcesAction } from "@/features/calendar-sync/calendar-sync.actions";
import { cn } from "@/lib/utils";

export function RoomOverviewSync({ propertyId, compact = false }: { propertyId?: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null);

  const synchronize = () => {
    if (pending) return;
    setNotice(null);
    startTransition(async () => {
      const result = await syncRoomOverviewCalendarSourcesAction({ propertyId });
      if (!result.success) {
        setNotice({ success: false, message: result.message });
        return;
      }
      const data = result.data;
      const applied = (data?.createdReservations ?? 0) + (data?.updatedReservations ?? 0);
      setNotice({
        success: true,
        message: data?.totalSources
          ? `동기화 완료: 성공 ${data.successCount}개 · 주의 ${data.warningCount}개 · 실패 ${data.failureCount}개 · 예약 ${applied}건 반영`
          : "동기화할 활성 캘린더 연결이 없습니다.",
      });
      router.refresh();
    });
  };

  return <>
    <Button type="button" variant="outline" size={compact ? "sm" : "default"} disabled={pending} onClick={synchronize} aria-label={pending ? "전체 캘린더 동기화 중" : "전체 캘린더 동기화"}>
      <RefreshCw className={cn(pending && "animate-spin")} />
      <span className="hidden sm:inline">{pending ? "동기화 중..." : "전체 동기화"}</span>
      <span className="sm:hidden">{pending ? "동기화 중..." : "동기화"}</span>
    </Button>
    {notice && <div role={notice.success ? "status" : "alert"} aria-live="polite" className={cn("fixed bottom-5 right-5 z-50 max-w-[calc(100vw-2rem)] rounded-lg border bg-card px-4 py-3 text-sm shadow-lg", notice.success ? "border-emerald-500/40" : "border-destructive/40 text-destructive")}>{notice.message}</div>}
  </>;
}
