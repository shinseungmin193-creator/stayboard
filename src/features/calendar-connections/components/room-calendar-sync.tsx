"use client";

import { useActionState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { syncRoomCalendarSourcesAction, type BulkSyncResult } from "@/features/calendar-sync/calendar-sync.actions";
import type { RoomCalendarFilters } from "../types/room-calendar-summary";

const initialState: ActionResult<BulkSyncResult> = { success: true };

export function RoomCalendarSync({ filters = {}, roomIds, compact = false }: { filters?: Pick<RoomCalendarFilters, "propertyId" | "roomId" | "provider" | "status">; roomIds?: readonly string[]; compact?: boolean }) {
  const [state, action, pending] = useActionState(syncRoomCalendarSourcesAction, initialState);
  const singleRoomId = filters.roomId ?? (roomIds?.length === 1 ? roomIds[0] : undefined);
  return (
    <div className="space-y-1">
      <form action={action}>
        <input type="hidden" name="propertyId" value={filters.propertyId ?? ""} />
        <input type="hidden" name="roomId" value={singleRoomId ?? ""} />
        <input type="hidden" name="provider" value={filters.provider ?? ""} />
        <input type="hidden" name="status" value={filters.status ?? ""} />
        <Button type="submit" size={compact ? "sm" : "default"} variant={compact ? "outline" : "default"} disabled={pending} aria-label={compact ? "이 객실의 활성 캘린더 연결 전체 동기화" : "현재 필터에 해당하는 모든 객실 동기화"}>
          <RefreshCcw className={pending ? "animate-spin" : undefined} />
          {pending ? "동기화 중" : compact ? "객실 동기화" : "표시 중인 객실 동기화"}
        </Button>
      </form>
      {state.message && <p aria-live="polite" className={`max-w-xl text-xs ${state.success ? "text-muted-foreground" : "text-destructive"}`}>{state.success && state.data ? `대상 객실 ${state.data.targetRoomCount}개 · 활성 연결 ${state.data.activeSourceCount}개 · 성공 ${state.data.successCount}개 · 주의 ${state.data.warningCount}개 · 실패 ${state.data.failureCount}개 · 건너뜀 ${state.data.skippedCount}개${state.data.roomsWithoutActiveSources ? ` · 연결 없음 ${state.data.roomsWithoutActiveSources}개` : ""}` : state.message}</p>}
    </div>
  );
}
