import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AccessDenied } from "@/features/access-control";
import { getDeveloperAccess } from "@/features/developer-management/server/developer-access";
import { developerCompanyListSchema } from "@/features/developer-management/developer-management.schemas";
import { listDeveloperCompanies } from "@/features/developer-management/developer-management.repository";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const t = await getTranslations(); return { title: t("navigation.items.developer-companies") }; }
const value = (params: Record<string, string | string[] | undefined>, key: string) => typeof params[key] === "string" ? params[key] : undefined;

export default async function DeveloperCompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [access, params, locale, t] = await Promise.all([getDeveloperAccess(), searchParams, getLocale(), getTranslations()]);
  if (!access) return <AccessDenied role={null} />;
  const parsed = developerCompanyListSchema.safeParse({ query: value(params, "query") ?? "", status: value(params, "status") ?? "ALL", sort: value(params, "sort") ?? "NEWEST", page: value(params, "page") ?? "1" });
  const filters = parsed.success ? parsed.data : developerCompanyListSchema.parse({});
  const result = await listDeveloperCompanies(filters);
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium", timeZone: "Asia/Tokyo" });
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (filters.query) next.set("query", filters.query);
    if (filters.status !== "ALL") next.set("status", filters.status);
    if (filters.sort !== "NEWEST") next.set("sort", filters.sort);
    next.set("page", String(page));
    return `/developer/companies?${next}`;
  };
  return <div className="space-y-4">
    <PageHeader title={t("navigation.items.developer-companies")} description={t("developerManagement.companies.description")} />
    <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_11rem_11rem_auto]">
      <Input name="query" defaultValue={filters.query} placeholder={t("developerManagement.companies.searchPlaceholder")} />
      <select name="status" defaultValue={filters.status} className="h-8 rounded-lg border bg-background px-2 text-sm">{(["ALL", "ACTIVE", "SUSPENDED", "NO_ADMIN"] as const).map((status) => <option key={status} value={status}>{t(`developerManagement.filters.companyStatus.${status}`)}</option>)}</select>
      <select name="sort" defaultValue={filters.sort} className="h-8 rounded-lg border bg-background px-2 text-sm">{(["NEWEST", "OLDEST", "NAME", "RECENT_ACTIVITY"] as const).map((sort) => <option key={sort} value={sort}>{t(`developerManagement.filters.companySort.${sort}`)}</option>)}</select>
      <Button type="submit" variant="outline">{t("auto.m0116")}</Button>
    </form>
    <div className="hidden overflow-hidden rounded-xl border bg-card md:block"><Table><TableHeader><TableRow><TableHead>{t("developerManagement.fields.company")}</TableHead><TableHead>{t("developerManagement.fields.status")}</TableHead><TableHead>{t("roles.ADMIN")}</TableHead><TableHead>{t("roles.STAFF")}</TableHead><TableHead>{t("common.property")}</TableHead><TableHead>{t("common.room")}</TableHead><TableHead>{t("developerManagement.fields.createdAt")}</TableHead><TableHead>{t("developerManagement.fields.lastActivityAt")}</TableHead><TableHead className="text-right">{t("common.details")}</TableHead></TableRow></TableHeader><TableBody>{result.items.map((company) => <TableRow key={company.id}><TableCell className="font-medium">{company.name}</TableCell><TableCell><Badge variant={company.isActive ? "secondary" : "destructive"}>{t(`developerManagement.companyStatus.${company.isActive ? "ACTIVE" : "SUSPENDED"}`)}</Badge></TableCell><TableCell>{company.adminCount}</TableCell><TableCell>{company.staffCount}</TableCell><TableCell>{company.propertyCount}</TableCell><TableCell>{company.roomCount}</TableCell><TableCell>{formatter.format(company.createdAt)}</TableCell><TableCell>{formatter.format(company.updatedAt)}</TableCell><TableCell className="text-right"><Button nativeButton={false} render={<Link href={`/developer/companies/${company.id}`} />} size="sm" variant="outline">{t("common.details")}</Button></TableCell></TableRow>)}</TableBody></Table></div>
    <div className="grid gap-3 md:hidden">{result.items.map((company) => <Card key={company.id}><CardContent className="space-y-3 p-4"><div className="flex justify-between gap-2"><p className="font-semibold">{company.name}</p><Badge variant={company.isActive ? "secondary" : "destructive"}>{t(`developerManagement.companyStatus.${company.isActive ? "ACTIVE" : "SUSPENDED"}`)}</Badge></div><dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">{t("roles.ADMIN")}</dt><dd>{company.adminCount}</dd></div><div><dt className="text-muted-foreground">{t("roles.STAFF")}</dt><dd>{company.staffCount}</dd></div><div><dt className="text-muted-foreground">{t("common.property")}</dt><dd>{company.propertyCount}</dd></div><div><dt className="text-muted-foreground">{t("common.room")}</dt><dd>{company.roomCount}</dd></div></dl><Button nativeButton={false} render={<Link href={`/developer/companies/${company.id}`} />} variant="outline" className="w-full">{t("common.details")}</Button></CardContent></Card>)}</div>
    {!result.items.length ? <p className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">{t("developerManagement.companies.empty")}</p> : null}
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{t("developerManagement.pagination.summary", { page: result.page, totalPages: result.totalPages, totalCount: result.totalCount })}</span><div className="flex gap-2"><Button nativeButton={false} render={<Link href={pageHref(Math.max(1, result.page - 1))} />} variant="outline" disabled={result.page <= 1}>{t("auto.m0014")}</Button><Button nativeButton={false} render={<Link href={pageHref(Math.min(result.totalPages, result.page + 1))} />} variant="outline" disabled={result.page >= result.totalPages}>{t("auto.m0015")}</Button></div></div>
  </div>;
}
