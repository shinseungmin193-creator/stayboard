"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteCalendarSourceAction, getCalendarSourceDeleteImpactAction } from "../calendar-source.actions";
import type { CalendarSourceDeleteImpact } from "../calendar-source.types";
import { isCalendarSourceDeleteConfirmationValid } from "../domain/calendar-source-deletion";

interface CalendarSourceDeleteDialogProps {
  source: { id: string; name: string; roomName: string; isSyncing: boolean };
  onDeleted: (calendarSourceId: string, message: string) => void;
}

export function CalendarSourceDeleteDialog({ source, onDeleted }: CalendarSourceDeleteDialogProps) {
  const t = useTranslations("calendarSourceDeletion");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [impact, setImpact] = useState<CalendarSourceDeleteImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [impactPending, startImpactTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const confirmationValid = isCalendarSourceDeleteConfirmationValid(confirmationText, source.name);

  const handleOpenChange = (nextOpen: boolean) => {
    if (deletePending) return;
    setOpen(nextOpen);
    if (!nextOpen) return;
    setConfirmationText("");
    setImpact(null);
    setError(source.isSyncing ? t("errors.syncing") : null);
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    startImpactTransition(async () => {
      const result = await getCalendarSourceDeleteImpactAction(source.id);
      if (!active) return;
      if (result.success) setImpact(result.data ?? null);
      else setError(result.message);
    });
    return () => { active = false; };
  }, [open, source.id]);

  const handleDelete = () => {
    if (!confirmationValid || !impact || deletePending || source.isSyncing) return;
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteCalendarSourceAction({ calendarSourceId: source.id, confirmationText });
      if (!result.success) {
        setError(result.message || t("errors.failed"));
        return;
      }
      setOpen(false);
      onDeleted(source.id, result.message || t("success"));
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="destructive"
            aria-label={t("ariaLabel", { name: source.name })}
          />
        }
      >
        <Trash2 />
        <span className="hidden sm:inline">{t("button")}</span>
      </DialogTrigger>
      <DialogContent role="alertdialog" className="sm:max-w-lg" showCloseButton={!deletePending}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { roomName: source.roomName, sourceName: source.name })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="rounded-lg border bg-muted/30 p-3" aria-busy={impactPending}>
            <h3 className="text-sm font-medium">{t("impactTitle")}</h3>
            {impact ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>{t("impact.reservations", { count: impact.reservationCount })}</li>
                <li>{t("impact.conflicts", { count: impact.conflictCount })}</li>
                <li>{t("impact.syncLogs", { count: impact.syncLogCount })}</li>
                <li>{t("impact.cleaningTasks", { count: impact.cleaningTaskCount })}</li>
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{impactPending ? t("loadingImpact") : t("errors.impactFailed")}</p>
            )}
          </section>

          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-5">
            <div className="flex gap-2 text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{t("warnings.irreversible")}</p></div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{t("warnings.noAutoSync")}</li>
              <li>{t("warnings.otherConnections")}</li>
              <li>{t("warnings.cleaningPreserved")}</li>
            </ul>
            <p className="border-t pt-2 text-muted-foreground">{t("deactivationDifference")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor={`calendar-source-delete-${source.id}`} className="text-sm font-medium">{t("confirmationLabel")}</label>
            <p className="text-xs text-muted-foreground">{t("confirmationHint")}</p>
            <Input
              id={`calendar-source-delete-${source.id}`}
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder={t("confirmationPlaceholder")}
              autoComplete="off"
              disabled={deletePending}
            />
          </div>

          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deletePending}>{t("cancel")}</Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!confirmationValid || !impact || impactPending || deletePending || source.isSyncing}
          >
            <Trash2 />
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
