"use client";import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { RefreshCcw } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { syncFilteredCalendarSourcesAction, type BulkSyncResult } from "@/features/calendar-sync/calendar-sync.actions";
import { Button } from "@/components/ui/button";
const initial: ActionResult<BulkSyncResult> = { success: false, message: "" };
export function CalendarBulkSync({ propertyId, roomId, provider }: {propertyId?: string;roomId?: string;provider?: string;}) {const i18n = useTranslations();const [state, action, pending] = useActionState(syncFilteredCalendarSourcesAction, initial);return <div className="space-y-2"><form action={action}><input type="hidden" name="propertyId" value={propertyId ?? ""} /><input type="hidden" name="roomId" value={roomId ?? ""} /><input type="hidden" name="provider" value={provider ?? ""} /><Button type="submit" variant="outline" disabled={pending}>{pending ? i18n("auto.m0260") : <><RefreshCcw />{i18n("auto.m0257")}</>}</Button></form>{state.message && <div aria-live="polite" className="max-w-sm rounded-md border bg-card p-2 text-xs"><p className="font-medium">{state.message}</p>{state.success && state.data && <p className="mt-1 text-muted-foreground">{i18n("auto.m0230")}{state.data.targetCount}{i18n("auto.m0261")}{state.data.successCount}{i18n("auto.m0262")}{state.data.warningCount}{i18n("auto.m0263")}{state.data.failedCount}{i18n("auto.m0264")}{state.data.alreadyRunningCount}</p>}</div>}</div>;}
