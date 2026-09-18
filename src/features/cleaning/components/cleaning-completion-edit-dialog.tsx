"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CleaningActionResult } from "../cleaning.actions";
import type { CleaningTaskViewModel, CleaningWorkerViewModel } from "../cleaning.types";
import { formatCleaningDateTimeInput, parseCleaningDateTimeInput } from "../domain/cleaning-date";
import { getSelectableCleaningWorkers } from "../domain/cleaning-worker";
import { CleaningPhotoUploader, type CleaningPhotoUploadState } from "./cleaning-photo-uploader";

export function CleaningCompletionEditDialog({
  task,
  workers: registeredWorkers,
  timeZone,
  pending,
  onClose,
  onSubmit,
  onUploadResult,
  onPhotoChanged,
}: {
  task: CleaningTaskViewModel | null;
  workers: CleaningWorkerViewModel[];
  timeZone: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { task: CleaningTaskViewModel; workerName: string; completedAt: string; note: string }) => void;
  onUploadResult: (result: CleaningActionResult) => void;
  onPhotoChanged: () => void;
}) {
  const t = useTranslations("cleaning.completionEdit");
  const workers = useMemo(
    () => getSelectableCleaningWorkers(registeredWorkers, task?.companyId ?? ""),
    [registeredWorkers, task?.companyId],
  );
  const initialWorkerName = task?.cleanerName ?? task?.assignee?.name ?? task?.completedBy?.name ?? "";
  const initialWorker = workers.find((worker) => worker.name === initialWorkerName);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(initialWorker?.id ?? null);
  const [workerName, setWorkerName] = useState(initialWorkerName);
  const [completedAt, setCompletedAt] = useState(formatCleaningDateTimeInput(task?.completedAt, timeZone));
  const [note, setNote] = useState(task?.note ?? "");
  const initialPhotoCount = task?.photos.filter((photo) => photo.url && !photo.deletedAt).length ?? 0;
  const [photoState, setPhotoState] = useState<CleaningPhotoUploadState>({
    persistedPhotoCount: initialPhotoCount,
    hasUnuploadedFiles: false,
    hasFailedFiles: false,
    isUploading: false,
    uploadsSettled: true,
  });
  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId);
  const parsedCompletedAt = parseCleaningDateTimeInput(completedAt, timeZone);
  const normalizedName = workerName.trim();
  const valid = normalizedName.length >= 1
    && normalizedName.length <= 30
    && Boolean(parsedCompletedAt)
    && note.trim().length <= 500
    && !photoState.hasUnuploadedFiles
    && !photoState.hasFailedFiles
    && !photoState.isUploading;

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => { if (!open && !pending && !photoState.isUploading) onClose(); }}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-2xl" data-cleaning-completion-edit-dialog>
        {task && <>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description", { room: task.roomName })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cleaning-completion-worker-select">{t("registeredWorker")}</Label>
              {workers.length > 0 ? <Select
                value={selectedWorkerId}
                onValueChange={(workerId) => {
                  const worker = workers.find((candidate) => candidate.id === workerId);
                  if (!worker) return;
                  setSelectedWorkerId(worker.id);
                  setWorkerName(worker.name);
                }}
              >
                <SelectTrigger id="cleaning-completion-worker-select" className="h-11 w-full min-w-0 bg-background">
                  <SelectValue>{selectedWorker?.name ?? t("registeredWorkerPlaceholder")}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false} className="max-w-[calc(100vw-2rem)]">
                  {workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}
                </SelectContent>
              </Select> : <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">{t("registeredWorkerEmpty")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cleaning-completion-worker-name">{t("workerName")}</Label>
              <Input
                id="cleaning-completion-worker-name"
                value={workerName}
                maxLength={30}
                autoComplete="name"
                placeholder={t("workerNamePlaceholder")}
                onChange={(event) => { setSelectedWorkerId(null); setWorkerName(event.target.value); }}
              />
              <p className="text-right text-xs text-muted-foreground">{normalizedName.length}/30</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cleaning-completion-at">{t("completedAt")}</Label>
              <Input id="cleaning-completion-at" type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} />
              {completedAt && !parsedCompletedAt && <p className="text-xs font-medium text-destructive">{t("invalidCompletedAt")}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2"><Label htmlFor="cleaning-completion-note">{t("note")}</Label><span className="text-xs text-muted-foreground">{note.trim().length}/500</span></div>
              <textarea id="cleaning-completion-note" value={note} maxLength={500} rows={3} onChange={(event) => setNote(event.target.value)} className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" placeholder={t("notePlaceholder")} />
            </div>
            <section className="space-y-3 rounded-xl border p-3">
              <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4" />{t("photos")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("photosDescription")}</p></div>
              <CleaningPhotoUploader
                taskId={task.id}
                initialPhotos={task.photos}
                disabled={pending}
                allowEmpty
                onResult={onUploadResult}
                onUploaded={onPhotoChanged}
                onDeleted={onPhotoChanged}
                onStateChange={setPhotoState}
              />
              {(photoState.hasUnuploadedFiles || photoState.hasFailedFiles) && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{t(photoState.hasFailedFiles ? "photoUploadFailed" : "photoUploadPending")}</p>}
            </section>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending || photoState.isUploading} onClick={onClose}>{t("cancel")}</Button>
            <Button
              type="button"
              data-cleaning-completion-save={task.id}
              disabled={pending || !valid}
              onClick={() => parsedCompletedAt && onSubmit({ task, workerName: normalizedName, completedAt: parsedCompletedAt.toISOString(), note })}
            >
              {pending ? <><LoaderCircle className="animate-spin" />{t("saving")}</> : t("save")}
            </Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
