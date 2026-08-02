"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserRole } from "@/features/access-control";
import type { CleaningTaskViewModel } from "../cleaning.types";

export type CleaningWorkflowMode = "assign" | "reassign" | "start" | "complete";

export function CleaningWorkflowDialog({
  task,
  mode,
  role,
  currentUserId,
  currentUserName,
  pending,
  onClose,
  onSubmit,
}: {
  task: CleaningTaskViewModel | null;
  mode: CleaningWorkflowMode | null;
  role: UserRole;
  currentUserId: string;
  currentUserName: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { task: CleaningTaskViewModel; mode: CleaningWorkflowMode; workerName: string; assigneeUserId?: string | null }) => void;
}) {
  const t = useTranslations("cleaning.workflow");
  const options = useMemo(() => {
    const map = new Map((task?.eligibleAssignees ?? []).map((assignee) => [assignee.id, assignee]));
    if (currentUserName) map.set(currentUserId, { id: currentUserId, name: currentUserName });
    return [...map.values()];
  }, [currentUserId, currentUserName, task]);
  const defaultName = task?.assignee?.name || currentUserName;
  const [workerName, setWorkerName] = useState(defaultName);
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const normalizedName = workerName.trim();
  const valid = normalizedName.length >= 1 && normalizedName.length <= 30;
  const assignmentMode = mode === "assign" || mode === "reassign";

  return (
    <Dialog open={Boolean(task && mode)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        {task && mode && <>
          <DialogHeader>
            <DialogTitle>{t(`titles.${mode}`)}</DialogTitle>
            <DialogDescription>{t("description", { room: task.roomName })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {assignmentMode && role !== "STAFF" && <label className="space-y-1.5 text-sm font-medium">
              <span>{t("account")}</span>
              <select
                value={selectedUserId}
                onChange={(event) => {
                  const id = event.target.value;
                  setSelectedUserId(id);
                  const selected = options.find((option) => option.id === id);
                  if (selected) setWorkerName(selected.name);
                }}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                <option value="external">{t("externalWorker")}</option>
              </select>
            </label>}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cleaning-worker-name">{t("workerName")}</Label>
                <Button type="button" variant="ghost" size="xs" onClick={() => setWorkerName(currentUserName)} disabled={!currentUserName}>
                  <UserRound />{t("useMyName")}
                </Button>
              </div>
              <Input id="cleaning-worker-name" value={workerName} onChange={(event) => setWorkerName(event.target.value)} maxLength={30} autoComplete="name" placeholder={t("namePlaceholder")} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>{t("nameHint")}</span><span>{normalizedName.length}/30</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
            <Button
              type="button"
              disabled={pending || !valid}
              onClick={() => onSubmit({ task, mode, workerName: normalizedName, ...(assignmentMode ? { assigneeUserId: selectedUserId === "external" ? null : selectedUserId } : {}) })}
            >
              {pending ? t("saving") : t(`submit.${mode}`)}
            </Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
