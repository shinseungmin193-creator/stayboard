"use client";

import { useActionState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { syncRoomCalendarSourcesAction, type BulkSyncResult } from "@/features/calendar-sync/calendar-sync.actions";

const initialState: ActionResult<BulkSyncResult> = { success: true };

export function RoomCalendarSync({ roomIds, compact = false }: { roomIds: readonly string[]; compact?: boolean }) {
  const [state, action, pending] = useActionState(syncRoomCalendarSourcesAction, initialState);
  return (
    <div className="space-y-1">
      <form action={action}>
        {[...new Set(roomIds)].map((roomId) => <input key={roomId} type="hidden" name="roomIds" value={roomId} />)}
        <Button type="submit" size={compact ? "sm" : "default"} variant={compact ? "outline" : "default"} disabled={pending || roomIds.length === 0} aria-label={compact ? "이 객실의 활성 캘린더 연결 전체 동기화" : "표시 중인 객실의 활성 캘린더 연결 전체 동기화"}>
          <RefreshCcw className={pending ? "animate-spin" : undefined} />
          {pending ? "동기화 중" : compact ? "객실 동기화" : "표시 중인 객실 동기화"}
        </Button>
      </form>
      {state.message && <p aria-live="polite" className={`max-w-sm text-xs ${state.success ? "text-muted-foreground" : "text-destructive"}`}>{state.message}{state.success && state.data ? ` · 대상 ${state.data.targetCount}, 성공 ${state.data.successCount}, 실패 ${state.data.failedCount}` : ""}</p>}
    </div>
  );
}
