"use client";

import { useTranslations } from "next-intl";
import { ImageIcon, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CleaningTaskViewModel } from "../cleaning.types";

export function CleaningStartCancelDialog({
  task,
  pending,
  onClose,
  onConfirm,
}: {
  task: CleaningTaskViewModel | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (task: CleaningTaskViewModel) => void;
}) {
  const t = useTranslations("cleaning.startCancellation");
  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        {task && <>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <ImageIcon className="mt-0.5 size-4 shrink-0" />
            <p>{t("preservedData")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("cancel")}</Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => onConfirm(task)}>
              <RotateCcw />{pending ? t("cancelling") : t("confirm")}
            </Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
