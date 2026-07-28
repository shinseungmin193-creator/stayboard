import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AccessDenied } from "@/features/access-control";
import { getDeveloperAccess } from "@/features/developer-management/server/developer-access";
import { developerUserListSchema } from "@/features/developer-management/developer-management.schemas";
import { listDeveloperUsers } from "@/features/developer-management/developer-management.repository";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const t = await getTranslations(); return { title: t("navigation.items.developer-users") }; }

function value(params: Record<string, string | string[] | undefined>, key: string) {
  return typeof params[key] === "string" ? params[key] : undefined;
}

export default async function DeveloperUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [access, params, locale, t] = await Promise.all([getDeveloperAccess(), searchParams, getLocale(), getTranslations()]);
  if (!access) return <AccessDenied role={null} />;
  const parsed = developerUserListSchema.safeParse({
    query: value(params, "query") ?? "",
    status: value(params, "status") ?? "CURRENT",
    role: value(params, "role") ?? "ALL",
    createdFrom: value(params, "createdFrom") ?? "",
    createdTo: value(params, "createdTo") ?? "",
    sort: value(params, "sort") ?? "NEWEST",
    page: value(params, "page") ?? "1",
  });
  const filters = parsed.success ? parsed.data : developerUserListSchema.parse({});
  const result = await listDeveloperUsers(filters);
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (filters.query) next.set("query", filters.query);
    if (filters.status !== "CURRENT") next.set("status", filters.status);
    if (filters.role !== "ALL") next.set("role", filters.role);
    if (filters.createdFrom) next.set("createdFrom", filters.createdFrom);
    if (filters.createdTo) next.set("createdTo", filters.createdTo);
    if (filters.sort !== "NEWEST") next.set("sort", filters.sort);
    next.set("page", String(page));
    return `/developer/users?${next}`;
  };
  const roleLabel = (item: (typeof result.items)[number]) => item.systemRole === "DEVELOPER"
    ? t("roles.DEVELOPER")
    : item.companyRoles.map((role) => t(`roles.${role}`)).join(" · ") || "-";

  return (
    <div className="space-y-4">
      <PageHeader title={t("navigation.items.developer-users")} description={t("developerManagement.users.description")} />
      <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_10rem_10rem_10rem_10rem_11rem_auto]">
        <Input name="query" defaultValue={filters.query} placeholder={t("developerManagement.users.searchPlaceholder")} />
        <select name="status" defaultValue={filters.status} className="h-8 rounded-lg border bg-background px-2 text-sm">
          {(["CURRENT", "ACTIVE", "SUSPENDED", "DELETED"] as const).map((status) => <option key={status} value={status}>{t(`developerManagement.filters.userStatus.${status}`)}</option>)}
        </select>
        <select name="role" defaultValue={filters.role} className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="ALL">{t("developerManagement.filters.allRoles")}</option>
          <option value="DEVELOPER">{t("roles.DEVELOPER")}</option>
          <option value="ADMIN">{t("roles.ADMIN")}</option>
          <option value="STAFF">{t("roles.STAFF")}</option>
        </select>
        <Input name="createdFrom" type="date" defaultValue={filters.createdFrom || ""} aria-label={t("developerManagement.filters.createdFrom")} />
        <Input name="createdTo" type="date" defaultValue={filters.createdTo || ""} aria-label={t("developerManagement.filters.createdTo")} />
        <select name="sort" defaultValue={filters.sort} className="h-8 rounded-lg border bg-background px-2 text-sm">
          {(["NEWEST", "OLDEST", "LAST_LOGIN", "NAME"] as const).map((sort) => <option key={sort} value={sort}>{t(`developerManagement.filters.userSort.${sort}`)}</option>)}
        </select>
        <Button type="submit" variant="outline">{t("auto.m0116")}</Button>
      </form>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("developerManagement.fields.user")}</TableHead>
            <TableHead>{t("developerManagement.fields.role")}</TableHead>
            <TableHead>{t("developerManagement.fields.status")}</TableHead>
            <TableHead>{t("developerManagement.fields.company")}</TableHead>
            <TableHead>{t("developerManagement.fields.createdAt")}</TableHead>
            <TableHead>{t("developerManagement.fields.lastLoginAt")}</TableHead>
            <TableHead className="text-right">{t("common.details")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>{result.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.username ?? "-"} · {item.email}</p></TableCell>
              <TableCell>{roleLabel(item)}</TableCell>
              <TableCell><Badge variant={item.status === "ACTIVE" ? "secondary" : item.status === "DELETED" ? "destructive" : "outline"}>{t(`developerManagement.userStatus.${item.status}`)}</Badge></TableCell>
              <TableCell className="max-w-56 truncate">{item.companyNames.join(", ") || "-"}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">{formatter.format(item.createdAt)}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">{item.lastLoginAt ? formatter.format(item.lastLoginAt) : "-"}</TableCell>
              <TableCell className="text-right"><Button nativeButton={false} render={<Link href={`/developer/users/${item.id}`} />} size="sm" variant="outline">{t("common.details")}</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {result.items.map((item) => (
          <Card key={item.id}><CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{item.name}</p><p className="truncate text-sm text-muted-foreground">{item.email}</p></div><Badge variant={item.status === "ACTIVE" ? "secondary" : item.status === "DELETED" ? "destructive" : "outline"}>{t(`developerManagement.userStatus.${item.status}`)}</Badge></div>
            <dl className="grid grid-cols-[5rem_1fr] gap-1 text-sm"><dt className="text-muted-foreground">{t("developerManagement.fields.role")}</dt><dd>{roleLabel(item)}</dd><dt className="text-muted-foreground">{t("developerManagement.fields.company")}</dt><dd className="truncate">{item.companyNames.join(", ") || "-"}</dd><dt className="text-muted-foreground">{t("developerManagement.fields.createdAt")}</dt><dd>{formatter.format(item.createdAt)}</dd></dl>
            <Button nativeButton={false} render={<Link href={`/developer/users/${item.id}`} />} variant="outline" className="w-full">{t("common.details")}</Button>
          </CardContent></Card>
        ))}
      </div>
      {!result.items.length ? <p className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">{t("developerManagement.users.empty")}</p> : null}
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{t("developerManagement.pagination.summary", { page: result.page, totalPages: result.totalPages, totalCount: result.totalCount })}</span><div className="flex gap-2"><Button nativeButton={false} render={<Link href={pageHref(Math.max(1, result.page - 1))} />} variant="outline" disabled={result.page <= 1}>{t("auto.m0014")}</Button><Button nativeButton={false} render={<Link href={pageHref(Math.min(result.totalPages, result.page + 1))} />} variant="outline" disabled={result.page >= result.totalPages}>{t("auto.m0015")}</Button></div></div>
    </div>
  );
}
