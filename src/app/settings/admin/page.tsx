import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied, authorizeAccess, companyScopeIds, hasPermission, PERMISSIONS } from "@/features/access-control";
import { getOrCreateCompanySettings, listSettingsCompanies } from "@/features/admin-settings";
import { AdminSettingsForm } from "@/features/admin-settings/components/admin-settings-form";
import { listPropertyOptions } from "@/features/properties";
import { listCalendarRoomOptions } from "@/features/calendar-sources";
import { listManagedUsers, UserManagementCard } from "@/features/user-management";

export const dynamic = "force-dynamic";
export const metadata = { title: "관리자 설정" };

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ companyId?: string | string[] }> }) {
  const access = await authorizeAccess(PERMISSIONS.ADMIN_SETTINGS_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const companies = await listSettingsCompanies(companyScopeIds(access.context));
  const params = await searchParams;
  const requestedCompanyId = typeof params.companyId === "string" ? params.companyId : undefined;
  const selectedCompany = companies.find((company) => company.id === requestedCompanyId) ?? companies[0];
  if (!selectedCompany) return <div className="space-y-4"><PageHeader title="관리자 설정" description="접근 가능한 회사가 없습니다." /></div>;
  const canManageUsers = hasPermission(access.context.role, PERMISSIONS.USER_MANAGE);
  const [settings, users, properties, rooms] = await Promise.all([
    getOrCreateCompanySettings(selectedCompany.id),
    canManageUsers ? listManagedUsers(access.context, selectedCompany.id) : [],
    canManageUsers ? listPropertyOptions([selectedCompany.id], access.context.scope) : [],
    canManageUsers ? listCalendarRoomOptions([selectedCompany.id], access.context.scope) : [],
  ]);
  return <div className="space-y-4"><PageHeader title="관리자 설정" description="회사별 운영 표시 정책과 계정을 관리합니다." />{companies.length > 1 && <form method="get" className="rounded-xl border bg-card p-3"><label className="flex items-center gap-3 text-sm font-medium">회사<select name="companyId" defaultValue={selectedCompany.id} className="h-8 min-w-60 rounded-md border border-input bg-background px-2">{companies.map((company) => <option key={company.id} value={company.id}>{company.name}{company.isActive ? "" : " · 비활성"}</option>)}</select><button type="submit" className="h-8 rounded-md border px-3 text-sm">선택</button></label></form>}<div className="space-y-4"><p className="text-sm font-semibold">{selectedCompany.name}</p><AdminSettingsForm key={selectedCompany.id} companyId={selectedCompany.id} settings={settings} />{canManageUsers && <UserManagementCard users={users} actorRole={access.context.role} actorUserId={access.context.userId} companyId={selectedCompany.id} properties={properties} rooms={rooms} />}</div></div>;
}
