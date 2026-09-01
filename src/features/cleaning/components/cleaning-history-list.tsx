"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Camera, Clock3, FileClock, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getZonedMidnight } from "@/lib/zoned-date";
import type { CleaningSectionData, CleaningTaskViewModel } from "../cleaning.types";
import { groupCompletedCleaningHistory } from "../domain/cleaning-history";
import { CleaningTaskStatusBadge } from "./cleaning-task-status-badge";

export function CleaningHistoryList({
  data,
  locale,
  timeZone,
  referenceAt,
  onOpenDetails,
}: {
  data: CleaningSectionData;
  locale: string;
  timeZone: string;
  referenceAt: string;
  onOpenDetails: (task: CleaningTaskViewModel, focus?: "photos" | "note" | "logs") => void;
}) {
  const t = useTranslations("cleaning");
  const day = useMemo(
    () => new Intl.DateTimeFormat(locale, { timeZone, year: "numeric", month: "long", day: "numeric" }),
    [locale, timeZone],
  );
  const dateTime = useMemo(
    () => new Intl.DateTimeFormat(locale, { timeZone, year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    [locale, timeZone],
  );
  const completionDay = useMemo(
    () => new Intl.DateTimeFormat(locale, { timeZone: DEFAULT_TIMEZONE, year: "numeric", month: "long", day: "numeric" }),
    [locale],
  );
  const groups = useMemo(
    () => groupCompletedCleaningHistory(data.items, new Date(referenceAt)),
    [data.items, referenceAt],
  );

  if (!data.items.length) {
    return <div className="rounded-2xl border border-dashed bg-muted/15 px-4 py-12 text-center"><p className="font-medium">{t("emptyHistory")}</p><p className="mt-1 text-sm text-muted-foreground">{t("history.emptyDescription")}</p></div>;
  }

  return <section className="space-y-3" aria-labelledby="cleaning-history-heading">
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 id="cleaning-history-heading" className="font-semibold">{t("history.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("history.description")}</p>
      </div>
      <span className="shrink-0 text-sm font-medium text-muted-foreground">{t("resultCount", { count: data.totalCount })}</span>
    </div>
    {data.totalPages > 1 && <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t("history.paginationHint", { page: data.page, total: data.totalPages })}</p>}
    <div className="space-y-6">
      {groups.map((group) => <section key={group.dateKey ?? "unknown"} data-cleaning-history-date={group.dateKey ?? "unknown"} className="space-y-3" aria-labelledby={`cleaning-history-date-${group.dateKey ?? "unknown"}`}>
        <div className="flex items-baseline gap-1.5 border-b pb-2">
          <h3 id={`cleaning-history-date-${group.dateKey ?? "unknown"}`} className="text-base font-bold">
            {group.kind === "date" && group.dateKey
              ? completionDay.format(getZonedMidnight(group.dateKey, DEFAULT_TIMEZONE))
              : t(`history.groups.${group.kind}`)}
          </h3>
          <span className="text-sm font-semibold text-muted-foreground">· {t("history.groups.count", { count: group.items.length })}</span>
        </div>
        <div className="space-y-3">
      {group.items.map((task) => {
        const activePhotos = task.photos.filter((photo) => photo.url && !photo.deletedAt);
        const workerName = task.cleanerName ?? task.assignee?.name ?? task.completedBy?.name ?? t("none");
        return <article key={task.id} data-cleaning-history-task-id={task.id} className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{task.companyName}</p>
              <h3 className="truncate text-base font-bold sm:text-lg">{task.propertyName} · {task.roomName}</h3>
            </div>
            <CleaningTaskStatusBadge task={task} />
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">{t("fields.property")}</dt><dd className="mt-0.5 font-medium">{task.propertyName}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("fields.room")}</dt><dd className="mt-0.5 font-medium">{task.roomName}</dd></div>
            <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><FileClock className="size-3.5" />{t("fields.cleaningDate")}</dt><dd className="mt-0.5 font-medium">{day.format(new Date(task.scheduledDate))}</dd></div>
            <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="size-3.5" />{t("fields.assignee")}</dt><dd className="mt-0.5 font-medium">{workerName}</dd></div>
            <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{t("fields.startedAt")}</dt><dd className="mt-0.5 font-medium">{task.startedAt ? dateTime.format(new Date(task.startedAt)) : t("none")}</dd></div>
            <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{t("fields.completedAt")}</dt><dd className="mt-0.5 font-medium">{task.completedAt ? dateTime.format(new Date(task.completedAt)) : t("none")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("fields.status")}</dt><dd className="mt-0.5 font-medium">{t("status.COMPLETED")}</dd></div>
          </dl>

          <div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Camera className="size-3.5" />{t("photos.title")}</p>
              {activePhotos.length > 0
                ? <div className="flex gap-2 overflow-hidden">{activePhotos.slice(0, 4).map((photo) => <button key={photo.id} type="button" className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted" onClick={() => onOpenDetails(task, "photos")}><Image unoptimized src={photo.url!} alt={t("photos.alt")} fill sizes="64px" className="object-cover" /></button>)}{task.photoCount > 4 && <button type="button" className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground" onClick={() => onOpenDetails(task, "photos")}>+{task.photoCount - 4}</button>}</div>
                : <p className="text-sm text-muted-foreground">{task.photoRetentionExpired ? t("photos.retentionExpired") : t("photos.none")}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenDetails(task, "logs")}><FileClock />{t("actions.details")}</Button>
          </div>
        </article>;
      })}
        </div>
      </section>)}
    </div>
  </section>;
}
