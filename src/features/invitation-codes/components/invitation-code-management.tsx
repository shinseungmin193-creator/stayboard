"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { ActionMessage } from "@/components/shared/action-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/action-result";
import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";
import type { InvitationCodeActionResult } from "../invitation-code.actions";
import { INVITATION_CODE_MESSAGES, type InvitationLocale } from "../invitation-code.messages";
import { getInvitationCodeDisplayStatus } from "../invitation-code.policy";
import type { InvitationCodeListItem } from "../invitation-code.types";
import { maskInvitationCodePrefix as maskInvitationCode } from "../invitation-code.view-model";

type InvitationAction = (state: InvitationCodeActionResult, formData: FormData) => Promise<InvitationCodeActionResult>;
const initial: InvitationCodeActionResult = { success: false, message: "" };

function messageState(state: InvitationCodeActionResult): ActionResult {
  return state.success ? { success: true, message: state.message } : state;
}

function PlainCode({
  code,
  codeId,
  role,
  expiresAt,
  revokeAction,
  pending,
  locale








}: {code: string;codeId: string;role: CompanyMemberRole;expiresAt: string;revokeAction: (formData: FormData) => void;pending: boolean;locale: InvitationLocale;}) {const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const [copied, setCopied] = useState(false);
  const messages = INVITATION_CODE_MESSAGES[locale];
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : localeTag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });
  return <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
    <p className="text-xs font-medium text-amber-900 dark:text-amber-100">{messages.oneTimeNotice}</p>
    <div className="flex flex-wrap items-center gap-2 text-xs"><Badge variant="outline">{role === "ADMIN" ? messages.admin : messages.staff}</Badge><span className="text-muted-foreground">{messages.expiresAt} {formatter.format(new Date(expiresAt))}</span></div>
    <div className="flex min-w-0 gap-2"><code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-2 text-xs font-semibold">{code}</code><Button type="button" size="icon" variant="outline" aria-label={messages.copyCode} onClick={async () => {await navigator.clipboard.writeText(code);setCopied(true);}}>{copied ? <Check /> : <Copy />}</Button></div>
    <form action={revokeAction} onSubmit={(event) => {if (!window.confirm(messages.revokeConfirm)) event.preventDefault();}}><input type="hidden" name="codeId" value={codeId} /><Button type="submit" size="sm" variant="destructive" disabled={pending}>{messages.revoke}</Button></form>
  </div>;
}

export function InvitationCodeManagement({
  codes,
  createAction,
  revokeAction,
  locale = "ko"





}: {codes: InvitationCodeListItem[];createAction: InvitationAction;revokeAction: InvitationAction;locale?: InvitationLocale;}) {const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const [createState, createFormAction, createPending] = useActionState(createAction, initial);
  const [revokeState, revokeFormAction, revokePending] = useActionState(revokeAction, initial);
  const messages = INVITATION_CODE_MESSAGES[locale];
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : localeTag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });
  const state = revokeState.message ? revokeState : createState;
  const now = new Date();

  return <section aria-labelledby="invitation-code-title">
    <Card className="max-w-2xl">
      <CardHeader className="pb-3"><CardTitle id="invitation-code-title" className="flex items-center gap-2 text-base"><KeyRound className="size-4" />{messages.title}</CardTitle><p className="text-xs leading-5 text-muted-foreground">{messages.description}</p></CardHeader>
      <CardContent className="space-y-3">
        {createState.success && createState.data && <PlainCode code={createState.data.plainToken} codeId={createState.data.id} role={createState.data.role} expiresAt={createState.data.expiresAt} revokeAction={revokeFormAction} pending={revokePending} locale={locale} />}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{(["ADMIN", "STAFF"] as const).map((role) => {
            const hasActive = codes.some((code) => code.role === role && getInvitationCodeDisplayStatus(code, now) === "ACTIVE");
            return <form key={role} action={createFormAction} onSubmit={(event) => {if (hasActive && !window.confirm(messages.replaceConfirm)) event.preventDefault();}}><input type="hidden" name="role" value={role} /><Button type="submit" className="w-full" variant={role === "ADMIN" ? "default" : "outline"} disabled={createPending}>{createPending ? messages.issuing : role === "ADMIN" ? messages.issueAdmin : messages.issueStaff}</Button></form>;
          })}</div>
        <div className="space-y-2">{codes.length ? codes.map((code) => {
            const displayStatus = getInvitationCodeDisplayStatus(code, now);
            return <article key={code.id} className="space-y-2 rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><code className="truncate text-xs font-semibold">{maskInvitationCode(code.codePrefix)}</code><Badge variant="outline">{code.role === "ADMIN" ? messages.admin : messages.staff}</Badge></div><Badge variant={displayStatus === "ACTIVE" ? "secondary" : "outline"}>{messages.status[displayStatus]}</Badge></div><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{messages.issuedAt} {formatter.format(code.createdAt)}</span><span>{messages.expiresAt} {formatter.format(code.expiresAt)}</span>{code.usedAt && <span>{messages.usedAt} {formatter.format(code.usedAt)}</span>}</div>{displayStatus === "ACTIVE" && <form action={revokeFormAction} onSubmit={(event) => {if (!window.confirm(messages.revokeConfirm)) event.preventDefault();}}><input type="hidden" name="codeId" value={code.id} /><Button type="submit" size="sm" variant="destructive" disabled={revokePending}>{messages.revoke}</Button></form>}</article>;
          }) : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{messages.noCodes}</p>}</div>
        <ActionMessage state={messageState(state)} />
      </CardContent>
    </Card>
  </section>;
}
