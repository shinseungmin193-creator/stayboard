"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, MessageSquareText, Plus, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from "@/features/access-control";
import type { CleaningActionResult } from "../cleaning.actions";
import type { CleaningTaskViewModel, CleaningWorkerViewModel } from "../cleaning.types";
import { getCleaningWorkerSelection, getSelectableCleaningWorkers } from "../domain/cleaning-worker";
import { getInitialCleaningWorkflowWorkerName } from "../domain/cleaning-workflow";
import { CleaningPhotoUploader, type CleaningPhotoUploadState } from "./cleaning-photo-uploader";
import { CleaningWorkerRegistrationDialog } from "./cleaning-worker-registration-dialog";

export type CleaningWorkflowMode = "assign" | "reassign" | "start" | "complete";

export function CleaningWorkflowDialog({
  task,
  mode,
  role,
  currentUserId,
  currentUserName,
  registeredWorkers,
  canCreateWorkers,
  pending,
  onClose,
  onSubmit,
  onUploadResult,
  onPhotoUploaded,
  onReviewRoomNotes,
  onWorkerCreated,
  onNotice,
}: {
  task: CleaningTaskViewModel | null;
  mode: CleaningWorkflowMode | null;
  role: UserRole;
  currentUserId: string;
  currentUserName: string;
  registeredWorkers: CleaningWorkerViewModel[];
  canCreateWorkers: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { task: CleaningTaskViewModel; mode: CleaningWorkflowMode; workerName: string; assigneeUserId?: string }) => void;
  onUploadResult: (result: CleaningActionResult) => void;
  onPhotoUploaded: () => void;
  onReviewRoomNotes: () => void;
  onWorkerCreated: (worker: CleaningWorkerViewModel) => void;
  onNotice: (message: string) => void;
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
    : getInitialCleaningWorkflowWorkerName({
        mode: mode === "complete" ? "complete" : "start",
        cleanerName: task?.cleanerName,
        assigneeName: task?.assignee?.name,
      });
  const [workerName, setWorkerName] = useState(defaultName);
  const workers = useMemo(
    () => getSelectableCleaningWorkers(registeredWorkers, task?.companyId ?? ""),
    [registeredWorkers, task?.companyId],
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(defaultSelectedUserId);
  const initialPhotoCount = task?.photos.filter((photo) => photo.url && !photo.deletedAt).length ?? 0;
  const [photoState, setPhotoState] = useState<CleaningPhotoUploadState>({
    persistedPhotoCount: initialPhotoCount,
    hasUnuploadedFiles: false,
    hasFailedFiles: false,
    isUploading: false,
    readyForCompletion: initialPhotoCount > 0,
  });
  const selectedAssignee = options.find((option) => option.id === selectedUserId);
  const showWorkerNameInput = !assignmentMode || selectedAssignee?.role === "STAFF";
  const normalizedName = workerName.trim();
  const validName = normalizedName.length >= 1 && normalizedName.length <= 30;
  const identityValid = assignmentMode ? Boolean(selectedAssignee) && (!showWorkerNameInput || validName) : validName;
  const valid = identityValid && (mode !== "complete" || photoState.readyForCompletion);
  const openRoomNoteCount = mode === "complete" ? task?.openRoomNotes.length ?? 0 : 0;
  const selectWorker = (worker: Pick<CleaningWorkerViewModel, "id" | "name">) => {
    const selection = getCleaningWorkerSelection(worker);
    setSelectedWorkerId(selection.selectedWorkerId);
    setWorkerName(selection.cleanerName);
  };

  return <>
    <Dialog open={Boolean(task && mode)} onOpenChange={(open) => { if (!open && !registrationOpen) onClose(); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
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
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="cleaning-registered-worker">{t("registeredWorker")}</Label>
                  {canCreateWorkers && mode === "start" && <Button type="button" variant="ghost" size="xs" className="shrink-0" disabled={pending} onClick={() => setRegistrationOpen(true)}>
                    <Plus />{t("registerName")}
                  </Button>}
                </div>
                {workers.length > 0 ? <Select
                  value={selectedWorkerId}
                  onValueChange={(workerId) => {
                    const selected = workers.find((worker) => worker.id === workerId);
                    if (selected) selectWorker(selected);
                  }}
                >
                  <SelectTrigger id="cleaning-registered-worker" className="h-11 w-full min-w-0 bg-background">
                    <SelectValue placeholder={t("registeredWorkerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false} className="max-w-[calc(100vw-2rem)]">
                    {workers.map((worker) => <SelectItem key={worker.id} value={worker.id} className="min-w-0">{worker.name}</SelectItem>)}
                  </SelectContent>
                </Select> : <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">{t("registeredWorkerEmpty")}</p>}
              </div>
              <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:border-t"><span className="relative bg-popover px-2">{t("orDirect")}</span></div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cleaning-worker-name">{t("workerName")}</Label>
                {!assignmentMode && <Button type="button" variant="ghost" size="xs" onClick={() => { setSelectedWorkerId(null); setWorkerName(currentUserName); }} disabled={!currentUserName}>
                  <UserRound />{t("useMyName")}
                </Button>}
              </div>
              {assignmentMode && <p className="text-xs text-muted-foreground">{t("workerNameDescription")}</p>}
              <Input id="cleaning-worker-name" value={workerName} onChange={(event) => { setSelectedWorkerId(null); setWorkerName(event.target.value); }} maxLength={30} autoComplete="name" placeholder={t("namePlaceholder")} />
              <div className="text-right text-xs text-muted-foreground">{normalizedName.length}/30</div>
            </div>}
            {mode === "complete" && <section className="space-y-3 rounded-xl border p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4" />{t("completionPhotos")}</h3>
              <p className="text-xs text-muted-foreground">{t("completionPhotosDescription")}</p>
              <CleaningPhotoUploader
                taskId={task.id}
                initialPhotos={task.photos}
                disabled={pending}
                onResult={onUploadResult}
                onUploaded={onPhotoUploaded}
                onStateChange={setPhotoState}
              />
              {!photoState.readyForCompletion && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{t(photoState.hasFailedFiles ? "photoUploadFailedHint" : photoState.hasUnuploadedFiles || photoState.isUploading ? "photoUploadPendingHint" : "photoRequiredHint")}</p>}
            </section>}
            {openRoomNoteCount > 0 && <section className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
              <p className="flex items-start gap-2 text-sm font-medium"><MessageSquareText className="mt-0.5 size-4 shrink-0" />{t("openRoomNotesWarning", { count: openRoomNoteCount })}</p>
              <p className="text-xs">{t("openRoomNotesNonBlocking")}</p>
              <Button type="button" variant="outline" size="sm" className="bg-background/80" disabled={pending} onClick={onReviewRoomNotes}><MessageSquareText />{t("reviewRoomNotes")}</Button>
            </section>}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
            <Button
              type="button"
              disabled={pending || photoState.isUploading || !valid}
              onClick={() => onSubmit({
                task,
                mode,
                workerName: showWorkerNameInput ? normalizedName : selectedAssignee?.name ?? "",
                ...(assignmentMode ? { assigneeUserId: selectedUserId } : {}),
              })}
            >
              {pending ? t("saving") : openRoomNoteCount > 0 ? t("submit.completeWithOpenNotes") : t(`submit.${mode}`)}
            </Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
    {registrationOpen && task && <CleaningWorkerRegistrationDialog
      companyId={task.companyId}
      companyName={task.companyName}
      initialName={workerName}
      open={registrationOpen}
      onOpenChange={setRegistrationOpen}
      onCreated={(worker) => {
        onWorkerCreated(worker);
        selectWorker(worker);
      }}
      onNotice={onNotice}
    />}
  </>;
}
