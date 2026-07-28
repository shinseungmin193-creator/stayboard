import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AccessDenied } from "@/features/access-control";
import { getDeveloperAccess } from "@/features/developer-management/server/developer-access";
import { getDeveloperUserDetail } from "@/features/developer-management/developer-management.repository";
import { UserManagementActions } from "@/features/developer-management/components/user-management-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const t = await getTranslations(); return { title: t("developerManagement.users.detailTitle") }; }

export default async function DeveloperUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId }, access, locale, t] = await Promise.all([params, getDeveloperAccess(), getLocale(), getTranslations()]);
  if (!access) return <AccessDenied role={null} />;
  const user = await getDeveloperUserDetail(userId);
  if (!user) notFound();
  const formatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });
  const date = (value: Date | null) => value ? formatter.format(value) : "-";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><PageHeader title={user.name} description={t("developerManagement.users.detailDescription")} /><Button nativeButton={false} render={<Link href="/developer/users" />} variant="outline">{t("developerManagement.actions.backToList")}</Button></div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHeader><CardTitle>{t("developerManagement.sections.basicInfo")}</CardTitle></CardHeader><CardContent><dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.name")}</dt><dd className="font-medium">{user.name}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.status")}</dt><dd><Badge variant={user.status === "ACTIVE" ? "secondary" : user.status === "DELETED" ? "destructive" : "outline"}>{t(`developerManagement.userStatus.${user.status}`)}</Badge></dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.email")}</dt><dd className="break-all">{user.email}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.username")}</dt><dd>{user.username ?? "-"}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.role")}</dt><dd>{user.systemRole === "DEVELOPER" ? t("roles.DEVELOPER") : user.memberships.map((membership) => `${membership.companyName} · ${t(`roles.${membership.role}`)}`).join(", ") || "-"}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.invitedBy")}</dt><dd>{user.invitedBy?.name ?? "-"}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.createdAt")}</dt><dd>{formatter.format(user.createdAt)}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.lastLoginAt")}</dt><dd>{date(user.lastLoginAt)}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.propertyScope")}</dt><dd>{user.propertyAssignmentCount}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.roomScope")}</dt><dd>{user.roomAssignmentCount}</dd></div>
        </dl></CardContent></Card>
        <Card><CardHeader><CardTitle>{t("developerManagement.sections.statusHistory")}</CardTitle></CardHeader><CardContent><dl className="space-y-3 text-sm">
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.suspendedAt")}</dt><dd>{date(user.suspendedAt)}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.suspendedBy")}</dt><dd>{user.suspendedBy?.name ?? "-"}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.suspensionReason")}</dt><dd className="whitespace-pre-wrap">{user.suspensionReason ?? "-"}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.deletedAt")}</dt><dd>{date(user.deletedAt)}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.deletedBy")}</dt><dd>{user.deletedBy?.name ?? "-"}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.deletionReason")}</dt><dd className="whitespace-pre-wrap">{user.deletionReason ?? "-"}</dd></div>
          <div><dt className="text-muted-foreground">{t("developerManagement.fields.anonymizedAt")}</dt><dd>{date(user.anonymizedAt)}</dd></div>
        </dl></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>{t("developerManagement.sections.memberships")}</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{user.memberships.map((membership) => <Link key={membership.id} href={`/developer/companies/${membership.companyId}`} className="rounded-lg border p-3 hover:bg-muted/50"><p className="font-medium">{membership.companyName}</p><p className="text-xs text-muted-foreground">{t(`roles.${membership.role}`)} · {membership.status}</p></Link>)}{!user.memberships.length ? <p className="text-sm text-muted-foreground">{t("developerManagement.users.noMemberships")}</p> : null}</CardContent></Card>
      <Card><CardHeader><CardTitle>{t("developerManagement.sections.managementActions")}</CardTitle></CardHeader><CardContent><UserManagementActions user={{ id: user.id, email: user.email, username: user.username, systemRole: user.systemRole, status: user.status, anonymizedAt: user.anonymizedAt, memberships: user.memberships }} actorUserId={access.userId} /></CardContent></Card>
      <Button nativeButton={false} render={<Link href={`/developer/audit-logs?targetUserId=${encodeURIComponent(user.id)}`} />} variant="outline">{t("developerManagement.actions.viewUserAudit")}</Button>
    </div>
  );
}
