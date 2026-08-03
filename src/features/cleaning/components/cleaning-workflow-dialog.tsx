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
  onSubmit: (input: { task: CleaningTaskViewModel; mode: CleaningWorkflowMode; workerName: string; assigneeUserId?: string }) => void;
}) {
  const t = useTranslations("cleaning.workflow");
  const assignmentMode = mode === "assign" || mode === "reassign";
  const options = useMemo(() => {
    const map = new Map((task?.eligibleAssignees ?? []).map((assignee) => [assignee.id, assignee]));
    if (currentUserName) map.set(currentUserId, { id: currentUserId, name: currentUserName, role });
    return [...map.values()];
  }, [currentUserId, currentUserName, role, task]);
  const defaultSelectedUserId = assignmentMode
    && task?.assignee?.userId
    && options.some((option) => option.id === task.assignee?.userId)
    ? task.assignee.userId
    : currentUserId;
  const defaultAssignee = options.find((option) => option.id === defaultSelectedUserId);
  const defaultName = assignmentMode
    ? defaultAssignee?.role === "STAFF"
      ? task?.assignee?.userId === defaultAssignee.id ? task.assignee.name : ""
      : defaultAssignee?.name ?? ""
    : task?.assignee?.name || currentUserName;
  const [workerName, setWorkerName] = useState(defaultName);
  const [selectedUserId, setSelectedUserId] = useState(defaultSelectedUserId);
  const selectedAssignee = options.find((option) => option.id === selectedUserId);
  const showWorkerNameInput = !assignmentMode || selectedAssignee?.role === "STAFF";
  const normalizedName = workerName.trim();
  const validName = normalizedName.length >= 1 && normalizedName.length <= 30;
  const valid = assignmentMode ? Boolean(selectedAssignee) && (!showWorkerNameInput || validName) : validName;

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
                  if (!selected) return;
                  const existingSnapshot = task.assignee?.userId === selected.id ? task.assignee.name : "";
                  setWorkerName(selected.role === "STAFF" ? existingSnapshot : selected.name);
                }}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </label>}
            {showWorkerNameInput && <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cleaning-worker-name">{t("workerName")}</Label>
                {!assignmentMode && <Button type="button" variant="ghost" size="xs" onClick={() => setWorkerName(currentUserName)} disabled={!currentUserName}>
                  <UserRound />{t("useMyName")}
                </Button>}
              </div>
              {assignmentMode && <p className="text-xs text-muted-foreground">{t("workerNameDescription")}</p>}
              <Input id="cleaning-worker-name" value={workerName} onChange={(event) => setWorkerName(event.target.value)} maxLength={30} autoComplete="name" placeholder={t("namePlaceholder")} />
              <div className="flex justify-end text-xs text-muted-foreground"><span>{normalizedName.length}/30</span></div>
            </div>}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
            <Button
              type="button"
              disabled={pending || !valid}
              onClick={() => onSubmit({
                task,
                mode,
                workerName: showWorkerNameInput ? normalizedName : selectedAssignee?.name ?? "",
                ...(assignmentMode ? { assigneeUserId: selectedUserId } : {}),
              })}
            >
              {pending ? t("saving") : t(`submit.${mode}`)}
            </Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
