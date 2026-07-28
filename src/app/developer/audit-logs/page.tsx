import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AccessDenied } from "@/features/access-control";
import { getDeveloperAccess } from "@/features/developer-management/server/developer-access";
import { developerAuditListSchema } from "@/features/developer-management/developer-management.schemas";
import { listDeveloperAuditLogs } from "@/features/developer-management/developer-management.repository";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const t = await getTranslations(); return { title: t("navigation.items.developer-audit-logs") }; }
const value = (params: Record<string, string | string[] | undefined>, key: string) => typeof params[key] === "string" ? params[key] : undefined;
const localizedActions = new Set([
  "USER_SUSPENDED",
  "USER_RESTORED",
  "USER_FORCE_LOGOUT",
  "USER_DELETED",
  "USER_ANONYMIZED",
  "USER_ROLE_CHANGED",
  "COMPANY_SUSPENDED",
  "COMPANY_RESTORED",
  "COMPANY_ADMIN_TRANSFERRED",
]);

export default async function DeveloperAuditLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [access, params, locale, t] = await Promise.all([getDeveloperAccess(), searchParams, getLocale(), getTranslations()]);
  if (!access) return <AccessDenied role={null} />;
  const parsed = developerAuditListSchema.safeParse({ actor: value(params, "actor") ?? "", target: value(params, "target") ?? "", company: value(params, "company") ?? "", targetUserId: value(params, "targetUserId") ?? "", targetCompanyId: value(params, "targetCompanyId") ?? "", action: value(params, "action") ?? "", createdFrom: value(params, "createdFrom") ?? "", createdTo: value(params, "createdTo") ?? "", page: value(params, "page") ?? "1" });
  const filters = parsed.success ? parsed.data : developerAuditListSchema.parse({});
  const result = await listDeveloperAuditLogs(filters);
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Tokyo" });
  const actionLabel = (action: string) => localizedActions.has(action) ? t(`developerManagement.audit.actions.${action}`) : action;
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, entry] of Object.entries(filters)) if (key !== "page" && entry) next.set(key, String(entry));
    next.set("page", String(page));
    return `/developer/audit-logs?${next}`;
  };
  return <div className="space-y-4">
    <PageHeader title={t("navigation.items.developer-audit-logs")} description={t("developerManagement.audit.description")} />
    <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(9rem,1fr))_12rem_10rem_10rem_auto]">
      <Input name="actor" defaultValue={filters.actor} placeholder={t("developerManagement.audit.actorPlaceholder")} />
      <Input name="target" defaultValue={filters.target} placeholder={t("developerManagement.audit.targetPlaceholder")} />
      <Input name="company" defaultValue={filters.company} placeholder={t("developerManagement.audit.companyPlaceholder")} />
      <select name="action" defaultValue={filters.action} className="h-8 rounded-lg border bg-background px-2 text-sm"><option value="">{t("developerManagement.audit.allActions")}</option>{result.actions.map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}</select>
      <Input name="createdFrom" type="date" defaultValue={filters.createdFrom || ""} aria-label={t("developerManagement.filters.createdFrom")} />
      <Input name="createdTo" type="date" defaultValue={filters.createdTo || ""} aria-label={t("developerManagement.filters.createdTo")} />
      <Button type="submit" variant="outline">{t("auto.m0116")}</Button>
    </form>
    <div className="hidden overflow-hidden rounded-xl border bg-card md:block"><Table><TableHeader><TableRow><TableHead>{t("developerManagement.fields.createdAt")}</TableHead><TableHead>{t("developerManagement.audit.action")}</TableHead><TableHead>{t("developerManagement.audit.actor")}</TableHead><TableHead>{t("developerManagement.audit.target")}</TableHead><TableHead>{t("developerManagement.fields.company")}</TableHead><TableHead>{t("developerManagement.fields.reason")}</TableHead><TableHead>{t("developerManagement.audit.metadata")}</TableHead></TableRow></TableHeader><TableBody>{result.items.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap text-xs">{formatter.format(log.createdAt)}</TableCell><TableCell><Badge variant="outline">{actionLabel(log.action)}</Badge></TableCell><TableCell>{log.actor.name}</TableCell><TableCell>{log.target ? <Link className="hover:underline" href={`/developer/users/${log.target.id}`}>{log.target.name}</Link> : "-"}</TableCell><TableCell>{log.targetCompany ? <Link className="hover:underline" href={`/developer/companies/${log.targetCompany.id}`}>{log.targetCompany.name}</Link> : "-"}</TableCell><TableCell className="max-w-64 whitespace-pre-wrap text-xs">{log.reason ?? "-"}</TableCell><TableCell><details className="max-w-72 text-xs"><summary className="cursor-pointer">{t("common.details")}</summary><pre className="mt-2 overflow-auto rounded border p-2">{log.details ? JSON.stringify(log.details, null, 2) : "-"}</pre></details></TableCell></TableRow>)}</TableBody></Table></div>
    <div className="grid gap-3 md:hidden">{result.items.map((log) => <Card key={log.id}><CardContent className="space-y-2 p-4"><div className="flex flex-wrap justify-between gap-2"><Badge variant="outline">{actionLabel(log.action)}</Badge><span className="text-xs text-muted-foreground">{formatter.format(log.createdAt)}</span></div><p className="text-sm">{log.actor.name} → {log.target?.name ?? log.targetCompany?.name ?? "-"}</p><p className="whitespace-pre-wrap text-xs text-muted-foreground">{log.reason ?? "-"}</p></CardContent></Card>)}</div>
    {!result.items.length ? <p className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">{t("developerManagement.audit.empty")}</p> : null}
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{t("developerManagement.pagination.summary", { page: result.page, totalPages: result.totalPages, totalCount: result.totalCount })}</span><div className="flex gap-2"><Button nativeButton={false} render={<Link href={pageHref(Math.max(1, result.page - 1))} />} variant="outline" disabled={result.page <= 1}>{t("auto.m0014")}</Button><Button nativeButton={false} render={<Link href={pageHref(Math.min(result.totalPages, result.page + 1))} />} variant="outline" disabled={result.page >= result.totalPages}>{t("auto.m0015")}</Button></div></div>
  </div>;
}
