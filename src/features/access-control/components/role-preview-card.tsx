"use client";import { useTranslations } from "next-intl";

import { useActionState, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { ActionMessage } from "@/components/shared/action-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type UserRole } from "../domain/access-control";
import { endRolePreviewAction, setRolePreviewAction, type RolePreviewActionResult } from "../role-preview.actions";

const initialState: RolePreviewActionResult = { success: true, message: "" };

export function RolePreviewCard({ actualRole, effectiveRole, previewRole, activeCompanyName }: {actualRole: UserRole;effectiveRole: UserRole;previewRole: UserRole | null;activeCompanyName?: string | null;}) {const i18n = useTranslations();
  const [selectedRole, setSelectedRole] = useState<UserRole>(previewRole ?? actualRole);
  const [state, action, pending] = useActionState(setRolePreviewAction, initialState);
  return <Card className="border-sky-500/40 bg-sky-500/5">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Eye className="size-4" />{i18n("auto.m0138")}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{i18n("auto.m0139")}</p>
      <div className="grid gap-2 rounded-lg border bg-background/70 p-3 text-sm sm:grid-cols-3">
        <p><span className="text-muted-foreground">{i18n("auto.m0140")}</span><strong className="ml-2">{i18n(`roles.${actualRole}`)}</strong></p>
        <p><span className="text-muted-foreground">{i18n("auto.m0141")}</span><strong className="ml-2">{i18n(`roles.${effectiveRole}`)}</strong></p>
        <p className="truncate"><span className="text-muted-foreground">{i18n("auto.m0142")}</span><strong className="ml-2">{activeCompanyName ?? i18n("auto.m0143")}</strong></p>
      </div>
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">{i18n("auto.m0144")}
          <select name="previewRole" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as UserRole)} className="h-11 w-full rounded-lg border bg-background px-3 md:h-8">
            <option value="DEVELOPER">{i18n("auto.m0145")}</option>
            <option value="ADMIN" disabled={!activeCompanyName}>{i18n("auto.m0146")}</option>
            <option value="STAFF" disabled={!activeCompanyName}>{i18n("auto.m0147")}</option>
          </select>
        </label>
        <Button type="submit" disabled={pending}>{pending ? i18n("auto.m0148") : i18n("auto.m0096")}</Button>
        <Button type="button" variant="outline" disabled={pending || !previewRole} onClick={() => void endRolePreviewAction()}><RotateCcw />{i18n("auto.m0149")}</Button>
      </form>
      {!activeCompanyName && <p className="text-xs text-amber-700 dark:text-amber-300">{i18n("auto.m0150")}</p>}
      <p className="text-xs text-muted-foreground">{i18n("auto.m0151")}</p>
      <ActionMessage state={state} />
    </CardContent>
  </Card>;
}
