"use client";
import { useActionState } from "react";
import { RefreshCcw } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { syncFilteredCalendarSourcesAction, type BulkSyncResult } from "@/features/calendar-sync/calendar-sync.actions";
import { Button } from "@/components/ui/button";
const initial: ActionResult<BulkSyncResult> = { success: false, message: "" };
export function CalendarBulkSync({ propertyId, roomId, provider }: { propertyId?: string; roomId?: string; provider?: string }) { const [state, action, pending] = useActionState(syncFilteredCalendarSourcesAction, initial); return <div className="space-y-2"><form action={action}><input type="hidden" name="propertyId" value={propertyId ?? ""} /><input type="hidden" name="roomId" value={roomId ?? ""} /><input type="hidden" name="provider" value={provider ?? ""} /><Button type="submit" variant="outline" disabled={pending}>{pending ? "전체 동기화 중" : <><RefreshCcw />표시 중인 객실 동기화</>}</Button></form>{state.message && <div aria-live="polite" className="max-w-sm rounded-md border bg-card p-2 text-xs"><p className="font-medium">{state.message}</p>{state.success && state.data && <p className="mt-1 text-muted-foreground">대상 {state.data.targetCount} · 성공 {state.data.successCount} · 실패 {state.data.failedCount} · 실행 중 {state.data.alreadyRunningCount}</p>}</div>}</div>; }
