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
import { deleteRoomAction, getRoomDeleteImpactAction } from "../room.actions";
import { isRoomDeletionConfirmationValid } from "../domain/room-deletion";
import type { RoomDeleteImpact, RoomListItem } from "../room.types";

export function RoomDeleteDialog({ room }: { room: RoomListItem }) {
  const t = useTranslations("roomDeletion");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [impact, setImpact] = useState<RoomDeleteImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [impactPending, startImpactTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const confirmationValid = isRoomDeletionConfirmationValid(confirmationText, room.name);

  const handleOpenChange = (nextOpen: boolean) => {
    if (deletePending && !success) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      if (success) router.refresh();
      return;
    }
    setConfirmationText("");
    setImpact(null);
    setError(null);
    setSuccess(null);
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    startImpactTransition(async () => {
      const result = await getRoomDeleteImpactAction(room.id);
      if (!active) return;
      if (result.success) setImpact(result.data ?? null);
      else setError(result.message);
    });
    return () => { active = false; };
  }, [open, room.id]);

  const handleDelete = () => {
    if (!confirmationValid || !impact || deletePending) return;
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteRoomAction({ roomId: room.id, confirmationText });
      if (!result.success) {
        setError(result.message || t("errors.failed"));
        return;
      }
      setSuccess(result.message || t("success", { name: room.name }));
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
            aria-label={t("ariaLabel", { name: room.name })}
          />
        }
      >
        <Trash2 />
        <span className="hidden lg:inline">{t("button")}</span>
      </DialogTrigger>
      <DialogContent role="alertdialog" className="sm:max-w-lg" showCloseButton={!deletePending || Boolean(success)}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { property: room.propertyName, name: room.name })}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            {success}
          </p>
        ) : <div className="space-y-4">
          <section className="rounded-lg border bg-muted/30 p-3" aria-busy={impactPending}>
            <h3 className="text-sm font-medium">{t("impactTitle")}</h3>
            {impact ? (
              <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <li>{t("impact.reservations", { count: impact.reservationCount })}</li>
                <li>{t("impact.calendarSources", { count: impact.calendarSourceCount })}</li>
                <li>{t("impact.syncHistory", { count: impact.syncHistoryCount })}</li>
                <li>{t("impact.conflicts", { count: impact.conflictCount })}</li>
                <li>{t("impact.cleaningTasks", { count: impact.cleaningTaskCount })}</li>
                <li>{t("impact.cleaningPhotos", { count: impact.cleaningPhotoCount })}</li>
                <li>{t("impact.roomNotes", { count: impact.roomNoteCount })}</li>
                <li>{t("impact.listings", { count: impact.roomListingCount })}</li>
                <li>{t("impact.reviews", { count: impact.reviewDataCount })}</li>
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {impactPending ? t("loadingImpact") : t("errors.impactFailed")}
              </p>
            )}
          </section>

          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-5">
            <div className="flex gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{t("warnings.irreversible")}</p>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{t("warnings.relatedData")}</li>
              <li>{t("warnings.propertyPreserved")}</li>
              <li>{t("warnings.deactivateAlternative")}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor={`room-delete-${room.id}`} className="text-sm font-medium">
              {t("confirmationLabel")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t("confirmationHint", { name: room.name })}
            </p>
            <Input
              id={`room-delete-${room.id}`}
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder={room.name}
              autoComplete="off"
              disabled={deletePending}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>}

        <DialogFooter>
          {success ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>{t("close")}</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deletePending}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={!confirmationValid || !impact || impactPending || deletePending}
              >
                <Trash2 />
                {deletePending ? t("deleting") : t("confirm")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

