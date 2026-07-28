import { getTranslations } from "next-intl/server";import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AccessDenied, authorizeAccess, companyScopeIds, PERMISSIONS } from "@/features/access-control";
import { listSettingsCompanies } from "@/features/admin-settings";
import { InvitationCodeManagement } from "@/features/invitation-codes/components/invitation-code-management";
import { createInvitationCodeAction, revokeInvitationCodeAction } from "@/features/invitation-codes/invitation-code.actions";
import { listInvitationCodes } from "@/features/invitation-codes/invitation-code.repository";
import { resolveInvitationLocale } from "@/features/invitation-codes/invitation-code.messages";
import { MemberManagement } from "@/features/member-management/components/member-management";
import { listCompanyMembers, listCompanyProperties } from "@/features/member-management/member-management.repository";
import { memberListSchema } from "@/features/member-management/member-management.schemas";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const i18n = await getTranslations(); return { title: i18n("navigation.items.member-management") }; }

export default async function MembersPage({ searchParams }: {searchParams: Promise<Record<string, string | string[] | undefined>>;}) {const i18n = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.USER_MANAGE);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const params = await searchParams;
  const locale = resolveInvitationLocale((await headers()).get("accept-language"));
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const companies = await listSettingsCompanies(companyScopeIds(access.context));
  const requestedCompanyId = value("companyId");
  const selectedCompany = companies.find((company) => company.id === requestedCompanyId) ?? (
  access.context.activeCompanyId ? companies.find((company) => company.id === access.context.activeCompanyId) : undefined) ??
  companies[0];
  if (!selectedCompany) return <div className="space-y-4"><PageHeader title={i18n("navigation.items.member-management")} description={i18n("auto.m0110")} /></div>;

  const parsed = memberListSchema.safeParse({ companyId: selectedCompany.id, page: value("page") ?? "1", query: value("query") ?? "", filter: value("filter") ?? "ALL" });
  const filters = parsed.success ? parsed.data : { companyId: selectedCompany.id, page: 1, query: "", filter: "ALL" as const };
  const [result, properties, invitationCodes] = await Promise.all([
  listCompanyMembers(filters),
  listCompanyProperties(selectedCompany.id),
  listInvitationCodes(selectedCompany.id)]
  );
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    next.set("companyId", selectedCompany.id);
    if (filters.query) next.set("query", filters.query);
    if (filters.filter !== "ALL") next.set("filter", filters.filter);
    next.set("page", String(page));
    return `/settings/members?${next}`;
  };
  const createAction = createInvitationCodeAction.bind(null, selectedCompany.id);
  const revokeAction = revokeInvitationCodeAction.bind(null, selectedCompany.id);

  return <div className="space-y-4">
    <PageHeader title={i18n("navigation.items.member-management")} description={i18n("auto.m0111")} />
    <InvitationCodeManagement codes={invitationCodes} createAction={createAction} revokeAction={revokeAction} locale={locale} />
    <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_10rem_auto]">
      <select name="companyId" defaultValue={selectedCompany.id} className="h-8 rounded-lg border bg-background px-2 text-sm">{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
      <input name="query" defaultValue={filters.query} placeholder={i18n("auto.m0112")} className="h-8 rounded-lg border bg-background px-3 text-sm" />
      <select name="filter" defaultValue={filters.filter} className="h-8 rounded-lg border bg-background px-2 text-sm"><option value="ALL">{i18n("auto.m0102")}</option><option value="ADMIN">{i18n("roles.ADMIN")}</option><option value="STAFF">{i18n("roles.STAFF")}</option><option value="DISABLED">{i18n("auto.m0115")}</option></select>
      <Button type="submit" variant="outline">{i18n("auto.m0116")}</Button>
    </form>
    <MemberManagement result={result} companyId={selectedCompany.id} properties={properties} actorUserId={access.context.userId} />
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{result.page} / {result.totalPages}{i18n("auto.m0088")}</span><div className="flex gap-2"><Button nativeButton={false} render={<Link href={pageHref(Math.max(1, result.page - 1))} />} variant="outline" disabled={result.page <= 1}>{i18n("auto.m0014")}</Button><Button nativeButton={false} render={<Link href={pageHref(Math.min(result.totalPages, result.page + 1))} />} variant="outline" disabled={result.page >= result.totalPages}>{i18n("auto.m0015")}</Button></div></div>
  </div>;
}
