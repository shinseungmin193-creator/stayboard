"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { ActionMessage } from "@/components/shared/action-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";
import {
  activateInvitationCodeAction,
  createInvitationCodeAction,
  deactivateInvitationCodeAction,
  revokeInvitationCodeAction,
  rotateInvitationCodeAction,
  type InvitationCodeActionResult,
} from "../invitation-code.actions";
import { maskInvitationCode } from "../invitation-code.service";
import type { InvitationCodeListItem } from "../invitation-code.types";

const initial: InvitationCodeActionResult = { success: false, message: "" };
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Tokyo",
});

function actionMessageState(state: InvitationCodeActionResult): ActionResult {
  return state.success ? { success: true, message: state.message } : state;
}

function PlainCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
      <p className="text-xs text-emerald-800 dark:text-emerald-200">
        보안을 위해 이 초대코드는 지금 한 번만 표시됩니다. 안전한 곳에 복사해 주세요.
      </p>
      <div className="mt-2 flex min-w-0 gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-2 text-xs font-semibold">
          {code}
        </code>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="초대코드 복사"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

function CodeRow({ code, companyId }: { code: InvitationCodeListItem; companyId: string }) {
  const [activateState, activateAction, activatePending] = useActionState(
    activateInvitationCodeAction,
    initial,
  );
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateInvitationCodeAction,
    initial,
  );
  const [rotateState, rotateAction, rotatePending] = useActionState(
    rotateInvitationCodeAction,
    initial,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeInvitationCodeAction,
    initial,
  );
  const state = rotateState.message
    ? rotateState
    : deactivateState.message
      ? deactivateState
      : activateState.message
        ? activateState
        : revokeState;
  const expired = Boolean(code.expiresAt && code.expiresAt <= new Date());

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="text-xs font-semibold">{maskInvitationCode(code.codePrefix)}</code>
        <Badge variant={code.isActive && !expired ? "secondary" : "outline"}>
          {expired ? "만료" : code.isActive ? "활성" : "비활성"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        사용 {code.usedCount}/{code.maxUses ?? "무제한"} · 만료{" "}
        {code.expiresAt ? dateFormatter.format(code.expiresAt) : "없음"}
      </p>
      <div className="flex flex-wrap gap-2">
        {code.isActive && (
          <form action={deactivateAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="codeId" value={code.id} />
            <Button size="sm" variant="outline" disabled={deactivatePending}>비활성화</Button>
          </form>
        )}
        {!code.isActive && (
          <form action={activateAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="codeId" value={code.id} />
            <Button size="sm" variant="outline" disabled={activatePending}>활성화</Button>
          </form>
        )}
        <form action={rotateAction}>
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="codeId" value={code.id} />
          <Button size="sm" variant="outline" disabled={rotatePending}>재발급</Button>
        </form>
        <form
          action={revokeAction}
          onSubmit={(event) => {
            if (!window.confirm("이 초대코드를 폐기하시겠습니까?")) event.preventDefault();
          }}
        >
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="codeId" value={code.id} />
          <Button size="sm" variant="destructive" disabled={revokePending}>폐기</Button>
        </form>
      </div>
      {rotateState.success && rotateState.data?.code && <PlainCode code={rotateState.data.code} />}
      <ActionMessage state={actionMessageState(state)} />
    </div>
  );
}

function RoleCard({
  companyId,
  role,
  codes,
}: {
  companyId: string;
  role: CompanyMemberRole;
  codes: InvitationCodeListItem[];
}) {
  const [state, action, pending] = useActionState(createInvitationCodeAction, initial);
  const label = role === "ADMIN" ? "관리자" : "직원";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" />
          {label} 초대코드
        </CardTitle>
        <p className="text-xs text-muted-foreground">가입 시 {label} 역할을 부여합니다.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={action} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="role" value={role} />
          <label className="space-y-1 text-xs">
            만료일 (선택)
            <Input name="expiresAt" type="date" />
          </label>
          <label className="space-y-1 text-xs">
            최대 사용 횟수
            <Input name="maxUses" type="number" min={1} max={10000} defaultValue={1} required />
          </label>
          <Button type="submit" className="sm:col-span-2" disabled={pending}>
            {pending ? "생성 중..." : `${label} 코드 생성`}
          </Button>
        </form>
        {state.success && state.data?.code && <PlainCode code={state.data.code} />}
        <ActionMessage state={actionMessageState(state)} />
        <div className="space-y-2">
          {codes.map((code) => <CodeRow key={code.id} code={code} companyId={companyId} />)}
          {!codes.length && (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              생성된 코드가 없습니다.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function InvitationCodeManagement({
  companyId,
  codes,
}: {
  companyId: string;
  codes: InvitationCodeListItem[];
}) {
  return (
    <section className="space-y-2" aria-labelledby="invitation-code-title">
      <div>
        <h2 id="invitation-code-title" className="text-lg font-semibold">초대코드 관리</h2>
        <p className="text-sm text-muted-foreground">
          회사 가입용 관리자·직원 코드를 발급하고 사용 상태를 관리합니다.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <RoleCard
          companyId={companyId}
          role="ADMIN"
          codes={codes.filter((code) => code.role === "ADMIN")}
        />
        <RoleCard
          companyId={companyId}
          role="STAFF"
          codes={codes.filter((code) => code.role === "STAFF")}
        />
      </div>
    </section>
  );
}
