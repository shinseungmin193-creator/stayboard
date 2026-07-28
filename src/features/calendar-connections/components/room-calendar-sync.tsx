"use client";import { useTranslations } from "next-intl";

import { useActionState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { syncRoomCalendarSourcesAction, type BulkSyncResult } from "@/features/calendar-sync/calendar-sync.actions";
import type { RoomCalendarFilters } from "../types/room-calendar-summary";

const initialState: ActionResult<BulkSyncResult> = { success: true };

export function RoomCalendarSync({ filters = {}, roomIds, compact = false }: {filters?: Pick<RoomCalendarFilters, "propertyId" | "roomId" | "provider" | "status">;roomIds?: readonly string[];compact?: boolean;}) {const i18n = useTranslations();
  const [state, action, pending] = useActionState(syncRoomCalendarSourcesAction, initialState);
  const singleRoomId = filters.roomId ?? (roomIds?.length === 1 ? roomIds[0] : undefined);
  return (
    <div className="space-y-1">
      <form action={action}>
        <input type="hidden" name="propertyId" value={filters.propertyId ?? ""} />
        <input type="hidden" name="roomId" value={singleRoomId ?? ""} />
        <input type="hidden" name="provider" value={filters.provider ?? ""} />
        <input type="hidden" name="status" value={filters.status ?? ""} />
        <Button type="submit" size={compact ? "sm" : "default"} variant={compact ? "outline" : "default"} disabled={pending} aria-label={compact ? i18n("auto.m0254") : i18n("auto.m0255")}>
          <RefreshCcw className={pending ? "animate-spin" : undefined} />
          {pending ? i18n("sync.statuses.RUNNING") : compact ? i18n("auto.m0256") : i18n("auto.m0257")}
        </Button>
      </form>
      {state.message && <p aria-live="polite" className={`max-w-xl text-xs ${state.success ? "text-muted-foreground" : "text-destructive"}`}>{state.success && state.data ? i18n("auto.m0258", { value0: state.data.targetRoomCount, value1: state.data.activeSourceCount, value2: state.data.successCount, value3: state.data.warningCount, value4: state.data.failureCount, value5: state.data.skippedCount, value6: state.data.roomsWithoutActiveSources ? i18n("auto.m0259", { value0: state.data.roomsWithoutActiveSources }) : "" }) : state.message}</p>}
    </div>);

}
