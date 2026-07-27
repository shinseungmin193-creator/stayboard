"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { USER_ROLE_LABELS, type UserRole } from "../domain/access-control";
import { endRolePreviewAction } from "../role-preview.actions";

export function RolePreviewBanner({ previewRole, scopeLabel }: { previewRole: UserRole; scopeLabel?: string | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  return <div className="fixed inset-x-2 top-2 z-50 mx-auto flex max-w-fit flex-wrap items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur lg:left-60">
    <span className="font-semibold">현재 {USER_ROLE_LABELS[previewRole]} 권한 미리보기 중</span>
    {scopeLabel && <span className="text-muted-foreground">{scopeLabel}</span>}
    <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await endRolePreviewAction(); if (!result.success) setMessage(result.message); })}><RotateCcw />{pending ? "복귀 중..." : "개발자 권한으로 복귀"}</Button>
    {message && <span className="text-destructive">{message}</span>}
  </div>;
}
