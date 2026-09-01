"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCleaningWorkerAction } from "../cleaning-worker.actions";
import type { CleaningWorkerViewModel } from "../cleaning.types";

export function CleaningWorkerRegistrationDialog({
  companyId,
  companyName,
  initialName,
  open,
  onOpenChange,
  onCreated,
  onNotice,
}: {
  companyId: string;
  companyName: string;
  initialName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (worker: CleaningWorkerViewModel) => void;
  onNotice: (message: string) => void;
}) {
  const t = useTranslations("cleaning.workers");
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const normalizedName = name.trim();
  const valid = normalizedName.length >= 1 && normalizedName.length <= 30;

  const submit = () => {
    if (!valid || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await createCleaningWorkerAction({ companyId, name: normalizedName });
      const message = result.message ?? t("messages.invalid");
      onNotice(message);
      if (!result.success || !result.data) {
        setError(message);
        return;
      }
      onCreated(result.data);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!pending) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("registrationTitle")}</DialogTitle>
          <DialogDescription>{t("registrationDescription", { company: companyName })}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="cleaning-worker-registration-name">{t("registrationName")}</Label>
            <Input
              id="cleaning-worker-registration-name"
              value={name}
              onChange={(event) => { setName(event.target.value); setError(null); }}
              maxLength={30}
              autoComplete="off"
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "cleaning-worker-registration-error" : undefined}
              placeholder={t("namePlaceholder")}
            />
            <div className="flex items-start justify-between gap-3 text-xs">
              <p id="cleaning-worker-registration-error" className="text-destructive" role={error ? "alert" : undefined}>{error}</p>
              <span className="ml-auto shrink-0 text-muted-foreground">{normalizedName.length}/30</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={pending || !valid}>{pending ? t("registering") : t("add")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
