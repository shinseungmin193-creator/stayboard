"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { ActionMessage } from "@/components/shared/action-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/action-result";
import type { InvitationCodeActionResult } from "../invitation-code.actions";
import { maskInvitationCode } from "../invitation-code.service";
import type { InvitationCodeListItem } from "../invitation-code.types";

type InvitationAction = (state: InvitationCodeActionResult, formData: FormData) => Promise<InvitationCodeActionResult>;
const initial: InvitationCodeActionResult = { success: false, message: "" };
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });

function messageState(state: InvitationCodeActionResult): ActionResult {
  return state.success ? { success: true, message: state.message } : state;
}

function PlainCode({ code, codeId, revokeAction, pending }: { code: string; codeId?: string; revokeAction: (formData: FormData) => void; pending: boolean }) {
  const [copied, setCopied] = useState(false);
  return <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
    <p className="text-xs font-medium text-amber-900 dark:text-amber-100">보안을 위해 이 코드는 지금 한 번만 표시됩니다.<br />복사하지 않고 화면을 닫으면 다시 확인할 수 없습니다.</p>
    <div className="flex min-w-0 gap-2"><code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-2 text-xs font-semibold">{code}</code><Button type="button" size="icon" variant="outline" aria-label="관리자 초대코드 복사" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); }}>{copied ? <Check /> : <Copy />}</Button></div>
    {codeId && <form action={revokeAction} onSubmit={(event) => { if (!window.confirm("이 초대코드를 폐기하시겠습니까?")) event.preventDefault(); }}><input type="hidden" name="codeId" value={codeId} /><Button type="submit" size="sm" variant="destructive" disabled={pending}>폐기</Button></form>}
  </div>;
}

export function InvitationCodeManagement({ codes, createAction, revokeAction }: { codes: InvitationCodeListItem[]; createAction: InvitationAction; revokeAction: InvitationAction }) {
  const [createState, createFormAction, createPending] = useActionState(createAction, initial);
  const [revokeState, revokeFormAction, revokePending] = useActionState(revokeAction, initial);
  const active = codes.find((code) => code.status === "ACTIVE");
  const latestUsed = codes.find((code) => code.status === "USED");
  const state = revokeState.message ? revokeState : createState;

  return <section aria-labelledby="admin-invitation-code-title">
    <Card className="max-w-2xl">
      <CardHeader className="pb-3"><CardTitle id="admin-invitation-code-title" className="flex items-center gap-2 text-base"><KeyRound className="size-4" />1회용 관리자 초대코드</CardTitle><p className="text-xs leading-5 text-muted-foreground">이 코드를 사용해 회원가입하면 선택한 회사의 관리자로 가입됩니다.<br />코드는 한 번 사용되면 자동으로 폐기됩니다.</p></CardHeader>
      <CardContent className="space-y-3">
        {createState.success && createState.data?.code && <PlainCode code={createState.data.code} codeId={createState.data.codeId} revokeAction={revokeFormAction} pending={revokePending} />}
        {active ? <div className="space-y-2 rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><code className="text-xs font-semibold">{maskInvitationCode(active.codePrefix)}</code><Badge variant="secondary">사용 가능</Badge></div><p className="text-xs text-muted-foreground">발행일 {dateFormatter.format(active.createdAt)}</p><div className="flex flex-wrap gap-2"><form action={revokeFormAction} onSubmit={(event) => { if (!window.confirm("이 초대코드를 폐기하시겠습니까?")) event.preventDefault(); }}><input type="hidden" name="codeId" value={active.id} /><Button type="submit" size="sm" variant="destructive" disabled={revokePending}>폐기</Button></form><form action={createFormAction} onSubmit={(event) => { if (!window.confirm("기존 활성 코드를 폐기하고 새 코드를 발행하시겠습니까?")) event.preventDefault(); }}><Button type="submit" size="sm" variant="outline" disabled={createPending}>{createPending ? "발행 중..." : "새 코드 발행"}</Button></form></div></div> : latestUsed ? <div className="space-y-1 rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><code className="text-xs font-semibold">{maskInvitationCode(latestUsed.codePrefix)}</code><Badge variant="outline">사용 완료</Badge></div><p className="text-xs text-muted-foreground">사용일 {latestUsed.usedAt ? dateFormatter.format(latestUsed.usedAt) : "확인할 수 없음"}</p><p className="text-xs text-muted-foreground">이 코드는 다시 사용할 수 없습니다.</p></div> : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">사용 가능한 관리자 초대코드가 없습니다.</p>}
        {!active && <form action={createFormAction}><Button type="submit" size="sm" disabled={createPending}>{createPending ? "발행 중..." : "초대코드 발행"}</Button></form>}
        <ActionMessage state={messageState(state)} />
      </CardContent>
    </Card>
  </section>;
}
