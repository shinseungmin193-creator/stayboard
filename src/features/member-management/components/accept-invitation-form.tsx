"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionMessage } from "@/components/shared/action-message";
import type { ActionResult } from "@/lib/action-result";
import { acceptCompanyInvitationAction } from "../member-management.actions";
const initial: ActionResult = { success: false, message: "" };
export function AcceptInvitationForm({ token, authenticated }: { token: string; authenticated: boolean }) { const [state, action, pending] = useActionState(acceptCompanyInvitationAction, initial); return <form action={action} className="space-y-3"><input type="hidden" name="token" value={token} />{!authenticated && <><Input name="name" placeholder="이름" required minLength={2} maxLength={50} /><Input name="password" type="password" placeholder="비밀번호 (8자 이상)" required minLength={8} maxLength={128} /></>}<Button type="submit" disabled={pending}>{pending ? "처리 중..." : authenticated ? "초대 수락" : "가입하고 초대 수락"}</Button><ActionMessage state={state} /></form>; }
