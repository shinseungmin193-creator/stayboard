import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { AccessDenied, authorizeAccess, getCurrentAccessContext, PERMISSIONS } from "@/features/access-control";
import {
  CLEANING_STATS_UNSPECIFIED_VALUE,
  type CleaningStatsFilters,
} from "@/features/cleaning/cleaning-stats.types";
import { getCleaningStatsPresetRange } from "@/features/cleaning/domain/cleaning-stats-date";
import { getCleaningStatsPage } from "@/features/cleaning/server/cleaning-stats.repository";
import { cn } from "@/lib/utils";
import { isValidDateInput } from "@/lib/zoned-date";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("cleaning.stats");
  return { title: t("title") };
}

function value(params: Record<string, string | string[] | undefined>, key: string) {
  return typeof params[key] === "string" ? params[key] : undefined;
}

function safeName(input: string | undefined): string | null {
  const name = input?.trim();
  return name && (name === CLEANING_STATS_UNSPECIFIED_VALUE || name.length <= 30) ? name : null;
}

function parseFilters(params: Record<string, string | string[] | undefined>): CleaningStatsFilters {
  const page = Number(value(params, "page") ?? "1");
  return {
    from: value(params, "from") ?? null,
    to: value(params, "to") ?? null,
    companyId: value(params, "companyId") ?? null,
    propertyId: value(params, "propertyId") ?? null,
    cleanerName: safeName(value(params, "cleanerName")),
    detailCleanerName: safeName(value(params, "detailCleanerName")),
    detailDate: isValidDateInput(value(params, "detailDate")) ? value(params, "detailDate")! : null,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

function statsHref(
  current: CleaningStatsFilters,
  patch: Partial<CleaningStatsFilters>,
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.companyId) params.set("companyId", next.companyId);
  if (next.propertyId) params.set("propertyId", next.propertyId);
  if (next.cleanerName) params.set("cleanerName", next.cleanerName);
  if (next.detailCleanerName) params.set("detailCleanerName", next.detailCleanerName);
  if (next.detailDate) params.set("detailDate", next.detailDate);
  if (next.page > 1) params.set("page", String(next.page));
  return `/cleaning/stats?${params}`;
}

export default async function CleaningStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, params, t, common, locale] = await Promise.all([
    getCurrentAccessContext(),
    searchParams,
    getTranslations("cleaning.stats"),
    getTranslations("common"),
    getLocale(),
  ]);
  if (!context) return <AccessDenied role={null} />;
  const access = await authorizeAccess(PERMISSIONS.STATISTICS_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const requestedFilters = parseFilters(params);
  const data = await getCleaningStatsPage(context, requestedFilters);
  const filters = { ...requestedFilters, from: data.range.from, to: data.range.to };
  const dateTime = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    timeZone: data.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const cleanerLabel = (name: string | null) => name ?? t("unspecified");
  const presets = [
    ["today", getCleaningStatsPresetRange("today")],
    ["thisWeek", getCleaningStatsPresetRange("this-week")],
    ["thisMonth", getCleaningStatsPresetRange("this-month")],
  ] as const;
  const activePreset = presets.find(([, range]) => range.from === data.range.from && range.to === data.range.to)?.[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="CLEANING PERFORMANCE"
        title={t("title")}
        description={t("description")}
        action={<Link href="/cleaning" className={buttonVariants({ variant: "outline" })}><ClipboardList />{t("back")}</Link>}
      />

      <section className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-3 gap-2">
          {presets.map(([key, range]) => <Link
            key={key}
            href={statsHref(filters, { ...range, detailCleanerName: null, detailDate: null, page: 1 })}
            className={buttonVariants({ variant: activePreset === key ? "default" : "outline" })}
          >{t(`presets.${key}`)}</Link>)}
        </div>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{t("filters.from")}</span>
            <input type="date" name="from" defaultValue={data.range.from} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{t("filters.to")}</span>
            <input type="date" name="to" defaultValue={data.range.to} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{t("filters.company")}</span>
            <select name="companyId" defaultValue={filters.companyId ?? ""} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">
              <option value="">{t("filters.allCompanies")}</option>
              {data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{t("filters.property")}</span>
            <select name="propertyId" defaultValue={filters.propertyId ?? ""} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">
              <option value="">{t("filters.allProperties")}</option>
              {data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{t("filters.worker")}</span>
            <select name="cleanerName" defaultValue={filters.cleanerName ?? ""} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">
              <option value="">{t("filters.allWorkers")}</option>
              {data.workerOptions.map((worker) => <option key={worker.value} value={worker.value}>{cleanerLabel(worker.name)}</option>)}
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
            <Link href="/cleaning/stats" className={cn(buttonVariants({ variant: "ghost" }), "flex-1 lg:flex-none")}>{t("filters.reset")}</Link>
            <button type="submit" className={cn(buttonVariants(), "flex-1 lg:flex-none")}>{t("filters.apply")}</button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-primary p-5 text-primary-foreground shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium opacity-85"><BarChart3 className="size-4" />{t("totalLabel")}</div>
        <p className="mt-2 text-3xl font-bold tabular-nums">{t("count", { count: data.totalCount })}</p>
        <p className="mt-1 text-xs opacity-75">{data.range.from} ~ {data.range.to}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t("workerTotals")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.workerTotals.map((worker) => <Link
              key={worker.cleanerName ?? CLEANING_STATS_UNSPECIFIED_VALUE}
              href={statsHref(filters, {
                detailCleanerName: worker.cleanerName ?? CLEANING_STATS_UNSPECIFIED_VALUE,
                detailDate: null,
                page: 1,
              })}
              className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
            >
              <span className="truncate font-medium">{cleanerLabel(worker.cleanerName)}</span>
              <span className="text-lg font-bold tabular-nums">{t("count", { count: worker.count })}</span>
            </Link>)}
            {!data.workerTotals.length && <p className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t("dailyTotals")}</h2>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="divide-y">
              {data.dailyGroups.map((group) => <Link
                key={`${group.date}-${group.cleanerName ?? CLEANING_STATS_UNSPECIFIED_VALUE}`}
                href={statsHref(filters, {
                  detailCleanerName: group.cleanerName ?? CLEANING_STATS_UNSPECIFIED_VALUE,
                  detailDate: group.date,
                  page: 1,
                })}
                className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 px-3 py-3 text-sm hover:bg-muted/50"
              >
                <span className="tabular-nums text-muted-foreground">{group.date}</span>
                <span className="truncate font-medium">{cleanerLabel(group.cleanerName)}</span>
                <span className="font-bold tabular-nums">{t("count", { count: group.count })}</span>
              </Link>)}
              {!data.dailyGroups.length && <p className="p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}
            </div>
          </div>
        </section>
      </div>

      {filters.detailCleanerName && <section className="space-y-3 border-t pt-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{t("details.title", { name: cleanerLabel(filters.detailCleanerName === CLEANING_STATS_UNSPECIFIED_VALUE ? null : filters.detailCleanerName) })}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{filters.detailDate ?? `${data.range.from} ~ ${data.range.to}`} · {t("count", { count: data.detailTotalCount })}</p>
          </div>
          <Link href={statsHref(filters, { detailCleanerName: null, detailDate: null, page: 1 })} className={buttonVariants({ variant: "ghost", size: "sm" })}>{common("close")}</Link>
        </div>
        <div className="grid gap-3">
          {data.details.map((detail) => <article key={detail.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{detail.propertyName} · {detail.roomName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dateTime.format(new Date(detail.completedAt))}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{cleanerLabel(detail.cleanerName)}</span>
            </div>
            <dl className="mt-3 grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t("details.account")}</dt><dd>{detail.completedByName ?? t("unspecified")}</dd>
              <dt className="text-muted-foreground">{t("details.photos")}</dt><dd>{t("photoCount", { count: detail.photoCount })}</dd>
              <dt className="text-muted-foreground">{t("details.note")}</dt><dd className="whitespace-pre-wrap">{detail.note || t("details.noNote")}</dd>
            </dl>
          </article>)}
          {!data.details.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("details.empty")}</p>}
        </div>
        {data.detailTotalPages > 1 && <nav className="flex items-center justify-center gap-2" aria-label={t("pagination.label")}>
          <Link
            aria-disabled={data.detailPage <= 1}
            href={statsHref(filters, { page: Math.max(1, data.detailPage - 1) })}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), data.detailPage <= 1 && "pointer-events-none opacity-50")}
          ><ChevronLeft />{t("pagination.previous")}</Link>
          <span className="text-sm font-medium">{data.detailPage} / {data.detailTotalPages}</span>
          <Link
            aria-disabled={data.detailPage >= data.detailTotalPages}
            href={statsHref(filters, { page: Math.min(data.detailTotalPages, data.detailPage + 1) })}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), data.detailPage >= data.detailTotalPages && "pointer-events-none opacity-50")}
          >{t("pagination.next")}<ChevronRight /></Link>
        </nav>}
      </section>}
    </div>
  );
}
