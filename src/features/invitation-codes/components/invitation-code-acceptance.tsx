"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { acceptInvitationCodeAction, type InvitationCodeAcceptanceResult } from "../invitation-code.actions";
import { INVITATION_CODE_MESSAGES, type InvitationLocale } from "../invitation-code.messages";

const initial: InvitationCodeAcceptanceResult = { success: false, message: "" };

export function InvitationCodeAcceptance({ locale = "ko" }: { locale?: InvitationLocale }) {
  const [state, action, pending] = useActionState(acceptInvitationCodeAction, initial);
  const messages = INVITATION_CODE_MESSAGES[locale];
  const messageState: ActionResult = state.success ? { success: true, message: state.message } : state;
  return <form action={action} className="space-y-3">
    <div className="space-y-1.5"><Label htmlFor="accept-invitation-code">{messages.codeLabel}</Label><Input id="accept-invitation-code" name="invitationCode" autoCapitalize="characters" autoComplete="off" placeholder="SB-ADMIN / SB-STAFF" required /></div>
    {state.success && state.data && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"><p>{messages.company}: {state.data.companyName}</p><p>{messages.role}: {state.data.role === "ADMIN" ? messages.admin : messages.staff}</p></div>}
    <Button type="submit" disabled={pending}>{pending ? messages.issuing : messages.acceptSubmit}</Button>
    <ActionMessage state={messageState} />
  </form>;
}
