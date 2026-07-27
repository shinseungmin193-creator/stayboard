"use client";

import { useActionState, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { ActionMessage } from "@/components/shared/action-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { USER_ROLE_LABELS, type UserRole } from "../domain/access-control";
import { endRolePreviewAction, setRolePreviewAction, type RolePreviewActionResult } from "../role-preview.actions";

const initialState: RolePreviewActionResult = { success: true, message: "" };

export function RolePreviewCard({ actualRole, effectiveRole, previewRole, activeCompanyName }: { actualRole: UserRole; effectiveRole: UserRole; previewRole: UserRole | null; activeCompanyName?: string | null }) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(previewRole ?? actualRole);
  const [state, action, pending] = useActionState(setRolePreviewAction, initialState);
  return <Card className="border-sky-500/40 bg-sky-500/5">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Eye className="size-4" />권한 미리보기</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">현재 개발자 계정을 유지하면서 관리자 또는 직원 화면을 확인합니다. 실제 계정 권한과 데이터는 변경되지 않습니다.</p>
      <div className="grid gap-2 rounded-lg border bg-background/70 p-3 text-sm sm:grid-cols-3">
        <p><span className="text-muted-foreground">실제 권한</span><strong className="ml-2">{USER_ROLE_LABELS[actualRole]}</strong></p>
        <p><span className="text-muted-foreground">적용 권한</span><strong className="ml-2">{USER_ROLE_LABELS[effectiveRole]}</strong></p>
        <p className="truncate"><span className="text-muted-foreground">회사 범위</span><strong className="ml-2">{activeCompanyName ?? "회사 선택 필요"}</strong></p>
      </div>
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">확인할 권한
          <select name="previewRole" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as UserRole)} className="h-11 w-full rounded-lg border bg-background px-3 md:h-8">
            <option value="DEVELOPER">개발자 권한</option>
            <option value="ADMIN" disabled={!activeCompanyName}>관리자 권한</option>
            <option value="STAFF" disabled={!activeCompanyName}>직원 권한</option>
          </select>
        </label>
        <Button type="submit" disabled={pending}>{pending ? "적용 중..." : "적용"}</Button>
        <Button type="button" variant="outline" disabled={pending || !previewRole} onClick={() => void endRolePreviewAction()}><RotateCcw />미리보기 종료</Button>
      </form>
      {!activeCompanyName && <p className="text-xs text-amber-700 dark:text-amber-300">회사 선택기에서 회사를 선택하면 ADMIN/STAFF 미리보기를 사용할 수 있습니다.</p>}
      <p className="text-xs text-muted-foreground">STAFF 테스트 범위는 현재 선택 회사의 활성 숙소 전체입니다.</p>
      <ActionMessage state={state} />
    </CardContent>
  </Card>;
}
