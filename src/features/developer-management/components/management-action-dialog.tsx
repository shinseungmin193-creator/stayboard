"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { DeveloperActionState } from "../developer-management.types";
import { INITIAL_DEVELOPER_ACTION_STATE } from "../developer-management.types";

type Action = (state: DeveloperActionState, formData: FormData) => Promise<DeveloperActionState>;

export function ManagementActionDialog({
  action,
  titleKey,
  descriptionKey,
  triggerKey,
  confirmKey,
  destructive = false,
  reasonRequired = true,
  children,
}: {
  action: Action;
  titleKey: string;
  descriptionKey: string;
  triggerKey: string;
  confirmKey?: string;
  destructive?: boolean;
  reasonRequired?: boolean;
  children: ReactNode;
}) {
  const i18n = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, INITIAL_DEVELOPER_ACTION_STATE);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
        <DialogTrigger render={<Button type="button" variant={destructive ? "destructive" : "outline"} size="sm" />}>
          {i18n(triggerKey)}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{i18n(titleKey)}</DialogTitle>
            <DialogDescription>{i18n(descriptionKey)}</DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            {children}
            <div className="space-y-1.5">
              <Label htmlFor={`${titleKey}-reason`}>{i18n("developerManagement.fields.reason")}</Label>
              <textarea
                id={`${titleKey}-reason`}
                name="reason"
                minLength={reasonRequired ? 3 : undefined}
                maxLength={500}
                required={reasonRequired}
                className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {state.messageKey && !state.success ? (
              <p role="alert" className="text-sm text-destructive">{i18n(state.messageKey)}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                {i18n("common.cancel")}
              </Button>
              <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
                {pending ? i18n("developerManagement.actions.processing") : i18n(confirmKey ?? triggerKey)}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {state.messageKey ? (
        <div
          role={state.success ? "status" : "alert"}
          className={`fixed bottom-5 right-5 z-[80] max-w-sm rounded-lg border bg-card px-4 py-3 text-sm shadow-lg ${state.success ? "border-emerald-500/40" : "border-destructive/40 text-destructive"}`}
        >
          {i18n(state.messageKey)}
        </div>
      ) : null}
    </>
  );
}

export function LastAdminResolutionFields({
  candidates,
}: {
  candidates: Array<{ id: string; name: string; email: string }>;
}) {
  const i18n = useTranslations();
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{i18n("developerManagement.lastAdmin.help")}</p>
      <div className="space-y-1.5">
        <Label>{i18n("developerManagement.lastAdmin.resolution")}</Label>
        <select name="lastAdminResolution" defaultValue="NONE" className="h-9 w-full rounded-lg border bg-background px-2 text-sm">
          <option value="NONE">{i18n("developerManagement.lastAdmin.block")}</option>
          <option value="TRANSFER">{i18n("developerManagement.lastAdmin.transfer")}</option>
          <option value="SUSPEND_COMPANY">{i18n("developerManagement.lastAdmin.suspendCompany")}</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>{i18n("developerManagement.lastAdmin.replacement")}</Label>
        <select name="replacementUserId" defaultValue="" className="h-9 w-full rounded-lg border bg-background px-2 text-sm">
          <option value="">{i18n("developerManagement.lastAdmin.selectReplacement")}</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
