import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied, authorizeAccess, canUseRolePreview, PERMISSIONS } from "@/features/access-control";
import { RolePreviewCard } from "@/features/access-control/components/role-preview-card";
import { DeveloperSettingsForm, DeveloperSettingsProvider } from "@/features/developer-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "개발자 설정" };

export default async function DeveloperSettingsPage() {
  const access = await authorizeAccess(PERMISSIONS.DEVELOPER_SETTINGS_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const rolePreviewEnabled = canUseRolePreview(process.env, access.context.actualRole);
  return <div className="space-y-4"><PageHeader title="개발자 설정" description="이 브라우저의 객실 현황 UI와 디버그 표시를 조정합니다." />{rolePreviewEnabled && <RolePreviewCard actualRole={access.context.actualRole} effectiveRole={access.context.effectiveRole} previewRole={access.context.previewRole} activeCompanyName={access.context.activeCompanyName} />}<DeveloperSettingsProvider><DeveloperSettingsForm /></DeveloperSettingsProvider></div>;
}
