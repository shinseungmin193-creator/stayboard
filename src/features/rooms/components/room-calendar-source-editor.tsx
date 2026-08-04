"use client";import { useTranslations, useLocale } from "next-intl";

import { type Dispatch, type SetStateAction, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, LoaderCircle, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { testRoomCalendarUrlAction } from "../room.actions";
import { ROOM_CALENDAR_PROVIDER_CONFIG, type RoomCalendarProvider } from "../room-calendar-draft";
import {
  createCalendarSourceClientId,
  createNewCalendarSourceDraft,
  removeNewCalendarSourceDraft,
  updateCalendarSourceDraftByKey,
  type CalendarSourceDraft } from
"../room-calendar-source-draft";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getReservationSyncStatusLabel } from "@/features/reservations/reservation-status-meta";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import { changeCalendarSourceActiveAction } from "@/features/calendar-sources/calendar-source.actions";
import { CalendarSourceDeleteDialog } from "@/features/calendar-sources/components/calendar-source-delete-dialog";







function formatDate(value: Date | null, localeTag: string, i18n: ReturnType<typeof useTranslations>) {const dateFormatter = new Intl.DateTimeFormat(localeTag, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" });
  return value ? dateFormatter.format(new Date(value)) : i18n("auto.m0295");
}

function draftStatus(draft: CalendarSourceDraft, i18n: ReturnType<typeof useTranslations>) {
  if (draft.kind === "existing" && draft.markedForDeletion) return { label: i18n("auto.m0555"), variant: "destructive" as const };
  if (draft.testState.status === "testing") return { label: i18n("auto.m0268"), variant: "secondary" as const };
  if (draft.testState.status === "success") return { label: i18n("auto.m0556"), variant: "secondary" as const };
  if (draft.testState.status === "failure") return { label: i18n("auto.m0557"), variant: "destructive" as const };
  if (draft.kind === "new") return { label: draft.url.trim() ? i18n("auto.m0558") : i18n("auto.m0559"), variant: "outline" as const };
  if (draft.url !== draft.originalUrl || draft.name !== draft.originalName || draft.isActive !== draft.originalIsActive) {
    return { label: i18n("auto.m0558"), variant: "outline" as const };
  }
  return { label: draft.isActive ? i18n("auto.m0513") : i18n("auto.m0115"), variant: draft.isActive ? "secondary" as const : "outline" as const };
}

function SourceRow({
  draft,
  supported,
  onChange,
  onRequestDisconnect,
  onRequestReconnect,
  onRemoveNew,
  onSourceDeleted,
  roomName,
  canDelete,
  sourceActionPending,
  errors







}: {draft: CalendarSourceDraft;supported: boolean;onChange: (update: (current: CalendarSourceDraft) => CalendarSourceDraft) => void;onRequestDisconnect: () => void;onRequestReconnect: () => void;onRemoveNew: () => void;onSourceDeleted: (calendarSourceId: string, message: string) => void;roomName: string;canDelete: boolean;sourceActionPending: boolean;errors?: string[];}) {const locale = useLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const i18n = useTranslations();
  const [testing, startTesting] = useTransition();
  const status = draftStatus(draft, i18n);
  const disabled = testing || sourceActionPending || draft.kind === "existing" && draft.markedForDeletion;
  const testConnection = () => {
    if (!supported || !draft.url.trim() || testing) return;
    const testedUrl = draft.url.trim();
    onChange((current) => ({ ...current, testState: { status: "testing" } }));
    startTesting(async () => {
      const result = await testRoomCalendarUrlAction({ provider: draft.provider, calendarUrl: testedUrl });
      if (result.success) {
        onChange((current) => current.url.trim() === testedUrl ?
        { ...current, url: testedUrl, testState: { status: "success", testedUrl, result: result.data } } :
        { ...current, testState: { status: "idle" } });
      } else {
        onChange((current) => current.url.trim() === testedUrl ?
        { ...current, url: testedUrl, testState: { status: "failure", testedUrl, code: result.code, message: result.message } } :
        { ...current, testState: { status: "idle" } });
      }
    });
  };
  const resetUrl = () => onChange((current) => ({
    ...current,
    url: current.kind === "existing" ? current.originalUrl : "",
    testState: { status: "idle" }
  }));

  return <div data-source-key={draft.key} className={cn("space-y-2 rounded-lg border bg-background/60 p-2.5", draft.kind === "existing" && draft.markedForDeletion && "opacity-70")}>
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={status.variant}>{status.label}</Badge>
      <span className="min-w-0 truncate text-xs font-medium">{draft.name || i18n("auto.m0560")}</span>
      {draft.kind === "existing" && <span className="ml-auto text-[11px] text-muted-foreground">{i18n("auto.m0213")}{formatDate(draft.sync.lastSyncedAt, localeTag, i18n)}</span>}
    </div>
    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(140px,0.7fr)_minmax(0,1.6fr)_92px_32px]">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`source-name-${draft.key}`} className="sr-only">{i18n("auto.m0289")}</Label>
        <Input
          id={`source-name-${draft.key}`}
          value={draft.name}
          onChange={(event) => {
            const value = event.target.value;
            onChange((current) => ({ ...current, name: value }));
          }}
          placeholder={i18n("auto.m0289")}
          maxLength={100}
          disabled={disabled} />
        
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`source-url-${draft.key}`} className="sr-only">{i18n("technical.icalUrl")}</Label>
        <Input
          id={`source-url-${draft.key}`}
          type="url"
          autoComplete="off"
          value={draft.url}
          onChange={(event) => {
            const value = event.target.value;
            onChange((current) => ({ ...current, url: value, testState: { status: "idle" } }));
          }}
          placeholder={supported ? "https://…" : i18n("auto.m0552")}
          maxLength={2000}
          disabled={!supported || disabled}
          className="min-w-0 font-mono text-xs" />
        
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={testConnection} disabled={!supported || !draft.url.trim() || disabled}>
        {testing ? <><LoaderCircle className="animate-spin" />{i18n("auto.m0268")}</> : i18n("auto.m0269")}
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={resetUrl} disabled={!supported || disabled || (draft.kind === "existing" ? draft.url === draft.originalUrl : !draft.url)} aria-label={i18n("auto.m0554", { value0: draft.name || i18n("auto.m0560") })}><RotateCcw /></Button>
    </div>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1 text-[11px]">
        {draft.testState.status === "success" && <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-3" />{getProviderLabel(draft.testState.result.provider, i18n)} · {i18n("technical.vevent")} {draft.testState.result.eventCount}{i18n("auto.m0553")}{draft.testState.result.responseTimeMs}ms</p>}
        {draft.testState.status === "failure" && <p className="flex items-start gap-1 text-destructive"><XCircle className="mt-0.5 size-3 shrink-0" />{draft.testState.message}</p>}
        {draft.testState.status === "idle" && draft.kind === "new" && <p className="flex items-center gap-1 text-muted-foreground"><Circle className="size-3" />{i18n("auto.m0561")}</p>}
        {draft.kind === "existing" && <div className="space-y-0.5 text-muted-foreground"><p>{draft.sync.latestSyncStatus ? getReservationSyncStatusLabel(draft.sync.latestSyncStatus, i18n) : i18n("auto.m0562")} · {i18n("technical.vevent")} {draft.sync.latestFetchedCount}{i18n("auto.m0563")}{formatDate(draft.sync.latestSyncStartedAt, localeTag, i18n)}</p>{draft.sync.latestErrorSummary && <p className="truncate text-destructive" title={draft.sync.latestErrorSummary}>{draft.sync.latestErrorSummary}</p>}</div>}
        {errors?.map((error) => <p key={error} className="mt-1 text-destructive">{error}</p>)}
      </div>
      {draft.kind === "existing" ? <div className="flex flex-wrap items-center justify-end gap-2">
        {draft.markedForDeletion ?
        <Button type="button" variant="outline" size="xs" disabled={sourceActionPending} onClick={() => onChange((current) => current.kind === "existing" ? { ...current, isActive: current.originalIsActive, markedForDeletion: false } : current)}>{i18n("auto.m0564")}</Button> :
        draft.isActive ?
        <Button type="button" variant="outline" size="xs" className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300" disabled={sourceActionPending} onClick={onRequestDisconnect}>{sourceActionPending && <LoaderCircle className="animate-spin" />}{i18n("auto.m0565")}</Button> :
        <Button type="button" variant="outline" size="xs" disabled={sourceActionPending} onClick={onRequestReconnect}>{sourceActionPending && <LoaderCircle className="animate-spin" />}{i18n("auto.m0566")}</Button>}
        {canDelete && <CalendarSourceDeleteDialog
          source={{ id: draft.id, name: draft.name, roomName, isSyncing: draft.sync.isSyncing }}
          onDeleted={onSourceDeleted}
          compact
          showButtonLabelOnMobile
        />}
      </div> :
      <Button type="button" variant="ghost" size="xs" onClick={onRemoveNew}><Trash2 />{i18n("auto.m0567")}</Button>}
    </div>
  </div>;
}

export function RoomCalendarSourceEditor({
  roomName,
  drafts,
  onDraftsChange,
  onSourceDeleted,
  onNotice,
  canManageCalendarSources,
  sourceErrors





}: {roomName: string;drafts: CalendarSourceDraft[];onDraftsChange: Dispatch<SetStateAction<CalendarSourceDraft[]>>;onSourceDeleted: (calendarSourceId: string, message: string) => void;onNotice: (message: string, success: boolean) => void;canManageCalendarSources: boolean;sourceErrors?: Record<string, string[]>;}) {const i18n = useTranslations();
  const router = useRouter();
  const [disconnectKey, setDisconnectKey] = useState<string | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [activeChangePending, startActiveChange] = useTransition();
  const disconnectDraft = drafts.find(
    (draft): draft is Extract<CalendarSourceDraft, {kind: "existing";}> => draft.key === disconnectKey && draft.kind === "existing"
  );
  const changeDraft = (key: string, update: (draft: CalendarSourceDraft) => CalendarSourceDraft) => {
    onDraftsChange((current) => updateCalendarSourceDraftByKey(current, key, update));
  };
  const addDraft = (provider: RoomCalendarProvider, label: string) => {
    const clientId = createCalendarSourceClientId();
    onDraftsChange((current) => [...current, createNewCalendarSourceDraft({
      drafts: current,
      provider,
      providerLabel: label,
      roomName,
      clientId
    })]);
  };
  const changeActiveState = (draft: Extract<CalendarSourceDraft, {kind: "existing";}>, isActive: boolean) => {
    if (activeChangePending) return;
    setActiveSourceId(draft.id);
    setActiveError(null);
    startActiveChange(async () => {
      const result = await changeCalendarSourceActiveAction({ id: draft.id, isActive });
      if (!result.success) {
        setActiveError(result.message);
        if (isActive) onNotice(result.message, false);
        setActiveSourceId(null);
        return;
      }
      changeDraft(draft.key, (current) => current.kind === "existing" ? {
        ...current,
        isActive,
        originalIsActive: isActive,
        markedForDeletion: false,
        testState: { status: "idle" }
      } : current);
      setDisconnectKey(null);
      setActiveSourceId(null);
      onNotice(result.message ?? i18n(isActive ? "calendarSourceDeletion.activeChange.activated" : "calendarSourceDeletion.activeChange.deactivated"), true);
      router.refresh();
    });
  };
  const confirmDisconnect = () => {
    if (!disconnectDraft) return;
    changeActiveState(disconnectDraft, false);
  };
  const handleSourceDeleted = (calendarSourceId: string, message: string) => {
    if (disconnectDraft?.id === calendarSourceId) setDisconnectKey(null);
    onSourceDeleted(calendarSourceId, message);
  };

  return <>
    <div className="space-y-2">
      {ROOM_CALENDAR_PROVIDER_CONFIG.map((config) => {
        const providerDrafts = drafts.filter((draft) => draft.provider === config.provider);
        const existingSourceCount = providerDrafts.filter((draft) => draft.kind === "existing").length;
        return <section key={config.provider} data-provider-group={config.provider} className="rounded-lg border bg-muted/20 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">{config.label}</h4>
            <Badge variant="outline">{providerDrafts.some((draft) => draft.kind === "existing" && draft.isActive && !draft.markedForDeletion) ? i18n("auto.m0513") : i18n("auto.m0559")}</Badge>
            <Badge variant="outline">{i18n("calendarSourceDeletion.connectionCount", { count: existingSourceCount })}</Badge>
            {!config.supported && <span className="text-[11px] text-muted-foreground">{i18n("auto.m0552")}</span>}
            <Button type="button" variant="ghost" size="xs" className="ml-auto" disabled={!config.supported} onClick={() => addDraft(config.provider, config.label)}><Plus />{config.label}{i18n("auto.m0568")}</Button>
          </div>
          {providerDrafts.length > 0 ? <div className="mt-2 space-y-2">{providerDrafts.map((draft) => <SourceRow
            key={draft.key}
            draft={draft}
            supported={config.supported}
            roomName={roomName}
            canDelete={canManageCalendarSources}
            sourceActionPending={activeChangePending && activeSourceId === (draft.kind === "existing" ? draft.id : null)}
            onChange={(update) => changeDraft(draft.key, update)}
            onRequestDisconnect={() => {setActiveError(null);setDisconnectKey(draft.key);}}
            onRequestReconnect={() => {if (draft.kind === "existing") changeActiveState(draft, true);}}
            onRemoveNew={() => onDraftsChange((current) => removeNewCalendarSourceDraft(current, draft.key))}
            onSourceDeleted={handleSourceDeleted}
            errors={sourceErrors?.[draft.key]}
          />)}</div> : <p className="mt-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">{i18n("calendarSourceDeletion.emptyProvider")}</p>}
        </section>;
      })}
    </div>
    <Dialog open={Boolean(disconnectDraft)} onOpenChange={(open) => {if (!open && !activeChangePending) {setDisconnectKey(null);setActiveError(null);}}}>
      <DialogContent className="sm:max-w-md" showCloseButton={!activeChangePending}>
        <DialogHeader><DialogTitle>{i18n("auto.m0569")}</DialogTitle><DialogDescription>{i18n("auto.m0570")}</DialogDescription></DialogHeader>
        {activeError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{activeError}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => {setDisconnectKey(null);setActiveError(null);}} disabled={activeChangePending}>{i18n("common.cancel")}</Button><Button type="button" variant="outline" className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300" onClick={confirmDisconnect} disabled={activeChangePending}>{activeChangePending && <LoaderCircle className="animate-spin" />}{i18n("auto.m0565")}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
