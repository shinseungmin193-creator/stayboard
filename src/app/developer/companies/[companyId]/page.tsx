import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AccessDenied } from "@/features/access-control";
import { getDeveloperAccess } from "@/features/developer-management/server/developer-access";
import { getDeveloperCompanyDetail } from "@/features/developer-management/developer-management.repository";
import { CompanyManagementActions } from "@/features/developer-management/components/company-management-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const t = await getTranslations(); return { title: t("developerManagement.companies.detailTitle") }; }

export default async function DeveloperCompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  const [{ companyId }, access, locale, t] = await Promise.all([params, getDeveloperAccess(), getLocale(), getTranslations()]);
  if (!access) return <AccessDenied role={null} />;
  const company = await getDeveloperCompanyDetail(companyId);
  if (!company) notFound();
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><PageHeader title={company.name} description={t("developerManagement.companies.detailDescription")} /><Button nativeButton={false} render={<Link href="/developer/companies" />} variant="outline">{t("developerManagement.actions.backToList")}</Button></div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>{t("developerManagement.sections.companyInfo")}</CardTitle></CardHeader><CardContent><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{t("developerManagement.fields.status")}</dt><dd><Badge variant={company.isActive ? "secondary" : "destructive"}>{t(`developerManagement.companyStatus.${company.isActive ? "ACTIVE" : "SUSPENDED"}`)}</Badge></dd></div><div><dt className="text-muted-foreground">{t("developerManagement.fields.createdAt")}</dt><dd>{formatter.format(company.createdAt)}</dd></div><div><dt className="text-muted-foreground">{t("roles.ADMIN")}</dt><dd>{company.adminCount}</dd></div><div><dt className="text-muted-foreground">{t("roles.STAFF")}</dt><dd>{company.staffCount}</dd></div><div><dt className="text-muted-foreground">{t("common.property")}</dt><dd>{company.propertyCount}</dd></div><div><dt className="text-muted-foreground">{t("common.room")}</dt><dd>{company.roomCount}</dd></div></dl></CardContent></Card>
      <Card><CardHeader><CardTitle>{t("developerManagement.sections.statusHistory")}</CardTitle></CardHeader><CardContent><dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">{t("developerManagement.fields.suspendedAt")}</dt><dd>{company.suspendedAt ? formatter.format(company.suspendedAt) : "-"}</dd></div><div><dt className="text-muted-foreground">{t("developerManagement.fields.suspendedBy")}</dt><dd>{company.suspendedBy?.name ?? "-"}</dd></div><div><dt className="text-muted-foreground">{t("developerManagement.fields.suspensionReason")}</dt><dd className="whitespace-pre-wrap">{company.suspensionReason ?? "-"}</dd></div></dl></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>{t("developerManagement.sections.managementActions")}</CardTitle></CardHeader><CardContent><CompanyManagementActions companyId={company.id} isActive={company.isActive} candidates={company.adminCandidates} /></CardContent></Card>
    <Card><CardHeader><CardTitle>{t("developerManagement.sections.memberships")}</CardTitle></CardHeader><CardContent className="p-0"><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>{t("developerManagement.fields.user")}</TableHead><TableHead>{t("developerManagement.fields.role")}</TableHead><TableHead>{t("developerManagement.fields.status")}</TableHead><TableHead>{t("developerManagement.fields.lastLoginAt")}</TableHead><TableHead className="text-right">{t("common.details")}</TableHead></TableRow></TableHeader><TableBody>{company.memberships.map((membership) => <TableRow key={membership.id}><TableCell><p className="font-medium">{membership.user.name}</p><p className="text-xs text-muted-foreground">{membership.user.email}</p></TableCell><TableCell>{t(`roles.${membership.role}`)}</TableCell><TableCell>{membership.status}</TableCell><TableCell>{membership.user.lastLoginAt ? formatter.format(membership.user.lastLoginAt) : "-"}</TableCell><TableCell className="text-right"><Button nativeButton={false} render={<Link href={`/developer/users/${membership.user.id}`} />} size="sm" variant="outline">{t("common.details")}</Button></TableCell></TableRow>)}</TableBody></Table></div><div className="grid gap-2 p-3 md:hidden">{company.memberships.map((membership) => <Link key={membership.id} href={`/developer/users/${membership.user.id}`} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><div className="min-w-0"><p className="truncate font-medium">{membership.user.name}</p><p className="truncate text-xs text-muted-foreground">{membership.user.email}</p></div><Badge variant="outline">{t(`roles.${membership.role}`)}</Badge></div></Link>)}</div></CardContent></Card>
    <Button nativeButton={false} render={<Link href={`/developer/audit-logs?targetCompanyId=${encodeURIComponent(company.id)}`} />} variant="outline">{t("developerManagement.actions.viewCompanyAudit")}</Button>
  </div>;
}
