"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { Archive, LoaderCircle, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ActionMessage } from "@/components/shared/action-message";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getReservationDisplayLabel } from "@/features/reservations/reservation-display";
import { getReservationSourceStatusLabel } from "@/features/reservations/reservation-status-meta";
import type { ActionResult } from "@/lib/action-result";
import {
  dismissPastReservationConflictsAction,
  dismissReservationConflictAction,
  type ReservationConflictDismissalResult,
} from "../reservation-conflict.actions";
import type {
  ConflictBulkDismissalInput,
  ConflictListItem,
  ConflictReservationItem,
} from "../reservation-conflict.types";

type DismissalSelection =
  | { kind: "single"; conflict: ConflictListItem }
  | { kind: "bulk"; count: number };

function ReservationCell({ value }: { value: ConflictReservationItem }) {
  const locale = useLocale();
  const i18n = useTranslations();
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  return (
    <div className="min-w-44">
      <p className="font-medium">{getReservationDisplayLabel(value, i18n("auto.m0397"))}</p>
      <p className="text-xs text-muted-foreground">{formatter.format(value.startDate)} → {formatter.format(value.endDate)}</p>
      <p className="text-xs text-muted-foreground">{value.calendarSourceName} · {getReservationSourceStatusLabel(value.status, i18n)}</p>
    </div>
  );
}

export function ReservationConflictList({
  conflicts,
  canManage,
  dismissibleCount,
  showBulkDismissal,
  bulkFilter,
}: {
  conflicts: ConflictListItem[];
  canManage: boolean;
  dismissibleCount: number;
  showBulkDismissal: boolean;
  bulkFilter: ConflictBulkDismissalInput;
}) {
  const locale = useLocale();
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  const i18n = useTranslations();
  const router = useRouter();
  const [selection, setSelection] = useState<DismissalSelection | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [bulkCompleted, setBulkCompleted] = useState(false);
  const [result, setResult] = useState<ActionResult<ReservationConflictDismissalResult> | null>(null);
  const [pending, startTransition] = useTransition();
  const visibleConflicts = useMemo(
    () => conflicts.filter((conflict) => !hiddenIds.has(conflict.id)),
    [conflicts, hiddenIds],
  );
  const remainingDismissibleCount = bulkCompleted ? 0 : dismissibleCount;

  const handleOpenChange = (open: boolean) => {
    if (!open && !pending) setSelection(null);
  };

  const handleConfirm = () => {
    if (!selection || pending) return;
    startTransition(async () => {
      const actionResult = selection.kind === "single"
        ? await dismissReservationConflictAction({ conflictId: selection.conflict.id })
        : await dismissPastReservationConflictsAction(bulkFilter);
      setResult(actionResult);
      if (!actionResult.success) return;
      if (selection.kind === "single") {
        setHiddenIds((current) => new Set(current).add(selection.conflict.id));
      } else if ((actionResult.data?.count ?? 0) > 0) {
        setBulkCompleted(true);
        setHiddenIds((current) => {
          const next = new Set(current);
          for (const conflict of conflicts) {
            if (conflict.status === "ACTIVE" && conflict.isPast) next.add(conflict.id);
          }
          return next;
        });
      }
      setSelection(null);
      router.refresh();
    });
  };

  const dismissButton = (conflict: ConflictListItem, mobile = false) => canManage
    && conflict.status === "ACTIVE"
    && conflict.isPast
    ? (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={mobile ? "min-h-11 w-full" : undefined}
        onClick={() => { setResult(null); setSelection({ kind: "single", conflict }); }}
      >
        <Archive />
        {i18n("conflictCleanup.singleButton")}
      </Button>
    )
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">{result && <ActionMessage result={result} />}</div>
        {canManage && showBulkDismissal && (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={remainingDismissibleCount === 0 || pending}
            onClick={() => { setResult(null); setSelection({ kind: "bulk", count: remainingDismissibleCount }); }}
          >
            <Archive />
            {i18n("conflictCleanup.bulkButton")}
          </Button>
        )}
      </div>

      {!visibleConflicts.length ? (
        <Card>
          <CardContent className="flex min-h-72 items-center">
            <EmptyState icon={TriangleAlert} title={i18n("conflict.empty")} description={i18n("auto.m0374")} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {visibleConflicts.map((conflict) => (
              <Card key={conflict.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-semibold">{conflict.roomName}</p>
                      <p className="text-xs text-muted-foreground">{conflict.propertyName}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {conflict.isPast && conflict.status === "ACTIVE" && <Badge variant="outline">{i18n("conflictFilter.PAST")}</Badge>}
                      <Badge variant={conflict.status === "ACTIVE" ? "destructive" : "outline"}>{i18n(`conflictStatus.${conflict.status}`)}</Badge>
                    </div>
                  </div>
                  <ReservationCell value={conflict.reservationA} />
                  <ReservationCell value={conflict.reservationB} />
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {i18n("auto.m0375")}{formatter.format(conflict.overlapStart)} → {formatter.format(conflict.overlapEnd)} · {differenceInCalendarDays(conflict.overlapEnd, conflict.overlapStart)}{i18n("auto.m0376")}
                  </p>
                  {dismissButton(conflict, true)}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{i18n("auto.m0005")}</TableHead>
                  <TableHead>{i18n("auto.m0377")}</TableHead>
                  <TableHead>{i18n("auto.m0378")}</TableHead>
                  <TableHead>{i18n("auto.m0379")}</TableHead>
                  <TableHead>{i18n("auto.m0380")}</TableHead>
                  <TableHead>{i18n("common.status")}</TableHead>
                  {canManage && <TableHead className="text-right">{i18n("common.manage")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleConflicts.map((conflict) => (
                  <TableRow key={conflict.id}>
                    <TableCell><p className="font-medium">{conflict.propertyName}</p><p className="text-xs text-muted-foreground">{conflict.roomName}</p></TableCell>
                    <TableCell><ReservationCell value={conflict.reservationA} /></TableCell>
                    <TableCell><ReservationCell value={conflict.reservationB} /></TableCell>
                    <TableCell>{formatter.format(conflict.overlapStart)} → {formatter.format(conflict.overlapEnd)}<p className="text-xs text-muted-foreground">{differenceInCalendarDays(conflict.overlapEnd, conflict.overlapStart)}{i18n("auto.m0376")}</p></TableCell>
                    <TableCell>{formatter.format(conflict.detectedAt)}</TableCell>
                    <TableCell><Badge variant={conflict.status === "ACTIVE" ? "destructive" : "outline"}>{i18n(`conflictStatus.${conflict.status}`)}</Badge></TableCell>
                    {canManage && <TableCell className="text-right">{dismissButton(conflict)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Dialog open={Boolean(selection)} onOpenChange={handleOpenChange}>
        <DialogContent role="alertdialog" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{selection?.kind === "bulk" ? i18n("conflictCleanup.bulkTitle", { count: selection.count }) : i18n("conflictCleanup.singleTitle")}</DialogTitle>
            <DialogDescription>
              {selection?.kind === "bulk"
                ? i18n("conflictCleanup.bulkDescription", { count: selection.count })
                : i18n("conflictCleanup.singleDescription")}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            {i18n("conflictCleanup.reservationPreserved")}
          </p>
          {result && !result.success && <ActionMessage result={result} />}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setSelection(null)}>{i18n("common.cancel")}</Button>
            <Button type="button" disabled={pending} onClick={handleConfirm}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Archive />}
              {selection?.kind === "bulk" ? i18n("conflictCleanup.bulkConfirm", { count: selection.count }) : i18n("conflictCleanup.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
