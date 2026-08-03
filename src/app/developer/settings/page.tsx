import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied, authorizeAccess, PERMISSIONS } from "@/features/access-control";
import { DeveloperRoleSwitchCard } from "@/features/developer-role-switch/components/developer-role-switch-card";
import { DeveloperSettingsForm, DeveloperSettingsProvider } from "@/features/developer-settings";
import { normalizeStaffMobileDashboardPreference } from "@/features/dashboard-preferences/domain/dashboard-preference";
import { getStaffMobileDashboardPreference } from "@/features/dashboard-preferences/server/dashboard-preference.service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const i18n = await getTranslations();
  return { title: i18n("navigation.items.developer-settings") };
}

export default async function DeveloperSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ staffMobileCompanyId?: string | string[] }>;
}) {
  const i18n = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.DEVELOPER_SETTINGS_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;

  const companies = access.context.availableCompanies ?? [];
  const query = (await searchParams).staffMobileCompanyId;
  const requestedCompanyId = typeof query === "string" ? query : null;
  const selectedCompany = companies.find((company) => company.id === requestedCompanyId)
    ?? companies.find((company) => company.id === access.context.activeCompanyId)
    ?? null;
  const preference = selectedCompany
    ? await getStaffMobileDashboardPreference(selectedCompany.id)
    : normalizeStaffMobileDashboardPreference(null);

  return <div className="space-y-4">
    <PageHeader title={i18n("navigation.items.developer-settings")} description={i18n("auto.m0056")} />
    <DeveloperRoleSwitchCard />
    <DeveloperSettingsProvider>
      <DeveloperSettingsForm staffMobileDashboard={{
        companies,
        selectedCompanyId: selectedCompany?.id ?? null,
        selectedCompanyName: selectedCompany?.name ?? null,
        preference,
      }} />
    </DeveloperSettingsProvider>
  </div>;
}
