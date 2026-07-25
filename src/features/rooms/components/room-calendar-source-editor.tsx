"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, LoaderCircle, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { testRoomCalendarUrlAction } from "../room.actions";
import { ROOM_CALENDAR_PROVIDER_CONFIG, type RoomCalendarProvider } from "../room-calendar-draft";
import type { CalendarSourceDraft } from "../room-calendar-source-draft";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(new Date(value)) : "이력 없음";
}

function draftStatus(draft: CalendarSourceDraft) {
  if (draft.kind === "existing" && draft.markedForDeletion) return { label: "연결 해제 예정", variant: "destructive" as const };
  if (draft.testState.status === "testing") return { label: "테스트 중", variant: "secondary" as const };
  if (draft.testState.status === "success") return { label: "테스트 성공", variant: "secondary" as const };
  if (draft.testState.status === "failure") return { label: "테스트 실패", variant: "destructive" as const };
  if (draft.kind === "new") return { label: draft.url.trim() ? "변경됨" : "연결 안 됨", variant: "outline" as const };
  if (draft.url !== draft.originalUrl || draft.name !== draft.originalName || draft.isActive !== draft.originalIsActive) {
    return { label: "변경됨", variant: "outline" as const };
  }
  return { label: draft.isActive ? "연결됨" : "비활성", variant: draft.isActive ? "secondary" as const : "outline" as const };
}

function SourceRow({
  draft,
  supported,
  onChange,
  onRequestDisconnect,
  onRemoveNew,
  errors,
}: {
  draft: CalendarSourceDraft;
  supported: boolean;
  onChange: (next: CalendarSourceDraft) => void;
  onRequestDisconnect: () => void;
  onRemoveNew: () => void;
  errors?: string[];
}) {
  const [testing, startTesting] = useTransition();
  const status = draftStatus(draft);
  const disabled = testing || (draft.kind === "existing" && draft.markedForDeletion);
  const testConnection = () => {
    if (!supported || !draft.url.trim() || testing) return;
    const testedUrl = draft.url.trim();
    onChange({ ...draft, testState: { status: "testing" } });
    startTesting(async () => {
      const result = await testRoomCalendarUrlAction({ provider: draft.provider, calendarUrl: testedUrl });
      if (result.success) {
        onChange({ ...draft, url: testedUrl, testState: { status: "success", testedUrl, result: result.data } });
      } else {
        onChange({ ...draft, url: testedUrl, testState: { status: "failure", testedUrl, code: result.code, message: result.message } });
      }
    });
  };
  const resetUrl = () => onChange({
    ...draft,
    url: draft.kind === "existing" ? draft.originalUrl : "",
    testState: { status: "idle" },
  });

  return <div data-source-key={draft.key} className={cn("space-y-2 rounded-lg border bg-background/60 p-2.5", draft.kind === "existing" && draft.markedForDeletion && "opacity-70")}>
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={status.variant}>{status.label}</Badge>
      <span className="min-w-0 truncate text-xs font-medium">{draft.name || "새 연결"}</span>
      {draft.kind === "existing" && <span className="ml-auto text-[11px] text-muted-foreground">최근 동기화 {formatDate(draft.sync.lastSyncedAt)}</span>}
    </div>
    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(140px,0.7fr)_minmax(0,1.6fr)_92px_32px]">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`source-name-${draft.key}`} className="sr-only">연결 이름</Label>
        <Input id={`source-name-${draft.key}`} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="연결 이름" maxLength={100} disabled={disabled} />
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`source-url-${draft.key}`} className="sr-only">iCal URL</Label>
        <Input id={`source-url-${draft.key}`} type="url" autoComplete="off" value={draft.url} onChange={(event) => onChange({ ...draft, url: event.target.value, testState: { status: "idle" } })} placeholder={supported ? "https://…" : "현재 연결 테스트 미지원"} maxLength={2000} disabled={!supported || disabled} className="min-w-0 font-mono text-xs" />
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={testConnection} disabled={!supported || !draft.url.trim() || disabled}>
        {testing ? <><LoaderCircle className="animate-spin" />테스트 중</> : "연결 테스트"}
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={resetUrl} disabled={!supported || disabled || (draft.kind === "existing" ? draft.url === draft.originalUrl : !draft.url)} aria-label={`${draft.name || "새 연결"} URL 초기화`}><RotateCcw /></Button>
    </div>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1 text-[11px]">
        {draft.testState.status === "success" && <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-3" />{draft.testState.result.provider} · VEVENT {draft.testState.result.eventCount}개 · {draft.testState.result.responseTimeMs}ms</p>}
        {draft.testState.status === "failure" && <p className="flex items-start gap-1 text-destructive"><XCircle className="mt-0.5 size-3 shrink-0" />{draft.testState.message}</p>}
        {draft.testState.status === "idle" && draft.kind === "new" && <p className="flex items-center gap-1 text-muted-foreground"><Circle className="size-3" />URL 입력 후 연결 테스트가 필요합니다.</p>}
        {draft.kind === "existing" && <div className="space-y-0.5 text-muted-foreground"><p>{draft.sync.latestSyncStatus ?? "동기화 이력 없음"} · VEVENT {draft.sync.latestFetchedCount} · 실행 {formatDate(draft.sync.latestSyncStartedAt)}</p>{draft.sync.latestErrorSummary && <p className="truncate text-destructive" title={draft.sync.latestErrorSummary}>{draft.sync.latestErrorSummary}</p>}</div>}
        {errors?.map((error) => <p key={error} className="mt-1 text-destructive">{error}</p>)}
      </div>
      {draft.kind === "existing" ? draft.markedForDeletion
        ? <Button type="button" variant="outline" size="xs" onClick={() => onChange({ ...draft, isActive: draft.originalIsActive, markedForDeletion: false })}>해제 취소</Button>
        : draft.isActive
          ? <Button type="button" variant="destructive" size="xs" onClick={onRequestDisconnect}><Trash2 />연결 해제</Button>
          : <Button type="button" variant="outline" size="xs" onClick={() => onChange({ ...draft, isActive: true })}>다시 연결</Button>
        : <Button type="button" variant="ghost" size="xs" onClick={onRemoveNew}><Trash2 />행 삭제</Button>}
    </div>
  </div>;
}

export function RoomCalendarSourceEditor({
  roomName,
  drafts,
  onDraftsChange,
  sourceErrors,
}: {
  roomName: string;
  drafts: CalendarSourceDraft[];
  onDraftsChange: (drafts: CalendarSourceDraft[]) => void;
  sourceErrors?: Record<string, string[]>;
}) {
  const [disconnectKey, setDisconnectKey] = useState<string | null>(null);
  const disconnectDraft = drafts.find(
    (draft): draft is Extract<CalendarSourceDraft, { kind: "existing" }> => draft.key === disconnectKey && draft.kind === "existing",
  );
  const changeDraft = (next: CalendarSourceDraft) => onDraftsChange(drafts.map((draft) => draft.key === next.key ? next : draft));
  const addDraft = (provider: RoomCalendarProvider, label: string) => {
    const clientId = crypto.randomUUID();
    const count = drafts.filter((draft) => draft.provider === provider).length;
    const baseName = `${roomName.trim() || "새 객실"} ${label}`;
    onDraftsChange([...drafts, {
      kind: "new",
      key: `new:${clientId}`,
      clientId,
      provider,
      name: count ? `${baseName} ${count + 1}` : baseName,
      url: "",
      isActive: true,
      testState: { status: "idle" },
    }]);
  };
  const confirmDisconnect = () => {
    if (!disconnectDraft) return;
    changeDraft({ ...disconnectDraft, isActive: false, markedForDeletion: true, testState: { status: "idle" } });
    setDisconnectKey(null);
  };

  return <>
    <div className="space-y-2">
      {ROOM_CALENDAR_PROVIDER_CONFIG.map((config) => {
        const providerDrafts = drafts.filter((draft) => draft.provider === config.provider);
        return <section key={config.provider} data-provider-group={config.provider} className="rounded-lg border bg-muted/20 p-2.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{config.label}</h4>
            <Badge variant="outline">{providerDrafts.some((draft) => draft.kind === "existing" && draft.isActive && !draft.markedForDeletion) ? "연결됨" : "연결 안 됨"}</Badge>
            {!config.supported && <span className="text-[11px] text-muted-foreground">현재 연결 테스트 미지원</span>}
            <Button type="button" variant="ghost" size="xs" className="ml-auto" disabled={!config.supported} onClick={() => addDraft(config.provider, config.label)}><Plus />{config.label} 연결 추가</Button>
          </div>
          {providerDrafts.length > 0 && <div className="mt-2 space-y-2">{providerDrafts.map((draft) => <SourceRow key={draft.key} draft={draft} supported={config.supported} onChange={changeDraft} onRequestDisconnect={() => setDisconnectKey(draft.key)} onRemoveNew={() => onDraftsChange(drafts.filter((item) => item.key !== draft.key))} errors={sourceErrors?.[draft.key]} />)}</div>}
        </section>;
      })}
    </div>
    <Dialog open={Boolean(disconnectDraft)} onOpenChange={(open) => { if (!open) setDisconnectKey(null); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader><DialogTitle>캘린더 연결 해제</DialogTitle><DialogDescription>이 캘린더 연결을 비활성화하시겠습니까? 기존 예약은 유지됩니다.</DialogDescription></DialogHeader>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDisconnectKey(null)}>취소</Button><Button type="button" variant="destructive" onClick={confirmDisconnect}>연결 해제</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
