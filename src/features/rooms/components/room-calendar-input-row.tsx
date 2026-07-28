"use client";import { useTranslations } from "next-intl";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import type { RoomCalendarTestActionResult } from "../room.actions";
import { testRoomCalendarUrlAction } from "../room.actions";
import { calendarUrlField, testedCalendarUrlField, type RoomCalendarProvider } from "../room-calendar-draft";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RoomCalendarInputRow({ provider, label, supported, serverErrors }: {provider: RoomCalendarProvider;label: string;supported: boolean;serverErrors?: string[];}) {const i18n = useTranslations();
  const [calendarUrl, setCalendarUrl] = useState("");
  const [result, setResult] = useState<RoomCalendarTestActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const currentResult = result && (result.success ? result.data.submittedUrl : result.submittedUrl) === calendarUrl ? result : null;
  const testedUrl = currentResult?.success ? currentResult.data.submittedUrl : "";
  const test = () => startTransition(async () => setResult(await testRoomCalendarUrlAction({ provider, calendarUrl })));
  const reset = () => {setCalendarUrl("");setResult(null);};
  const status = !supported ? { label: i18n("auto.m0548"), icon: XCircle, className: "text-muted-foreground" } : pending ? { label: i18n("auto.m0268"), icon: LoaderCircle, className: "text-blue-600" } : currentResult?.success ? { label: i18n("auto.m0549"), icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" } : currentResult ? { label: i18n("auto.m0550"), icon: XCircle, className: "text-destructive" } : { label: i18n("auto.m0551"), icon: Circle, className: "text-muted-foreground" };
  const StatusIcon = status.icon;
  return <div data-provider={provider} className="grid min-w-0 gap-2 rounded-lg border bg-background/60 p-2.5 lg:grid-cols-[120px_minmax(0,1fr)_92px_32px] lg:items-start"><div className="flex items-center justify-between gap-2 lg:block"><Badge variant="outline">{label}</Badge><span className={`flex items-center gap-1 text-[11px] lg:mt-2 ${status.className}`}><StatusIcon className={`size-3 ${pending ? "animate-spin" : ""}`} />{status.label}</span></div><div className="min-w-0"><Input name={calendarUrlField(provider)} type="url" autoComplete="off" maxLength={2000} value={calendarUrl} onChange={(event) => setCalendarUrl(event.target.value)} placeholder={supported ? "https://…" : i18n("auto.m0552")} disabled={!supported || pending} className="w-full min-w-0" /><input type="hidden" name={testedCalendarUrlField(provider)} value={testedUrl} />{currentResult?.success && <p className="mt-1 truncate text-[11px] text-emerald-700 dark:text-emerald-400">{i18n("technical.vevent")} {currentResult.data.eventCount}{i18n("auto.m0553")}{currentResult.data.responseTimeMs}ms</p>}{currentResult && !currentResult.success && <p className="mt-1 text-[11px] text-destructive">{currentResult.message}</p>}{serverErrors?.map((error) => <p key={error} className="mt-1 text-[11px] text-destructive">{error}</p>)}</div><Button type="button" variant="secondary" size="sm" onClick={test} disabled={!supported || !calendarUrl.trim() || pending}>{pending ? i18n("auto.m0268") : i18n("auto.m0269")}</Button><Button type="button" variant="ghost" size="icon-sm" onClick={reset} disabled={!supported || !calendarUrl && !result || pending} aria-label={i18n("auto.m0554", { value0: label })}><RotateCcw /></Button></div>;
}
