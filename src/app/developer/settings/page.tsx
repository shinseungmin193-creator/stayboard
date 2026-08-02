import { getTranslations } from "next-intl/server";import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied, authorizeAccess, PERMISSIONS } from "@/features/access-control";
import { DeveloperRoleSwitchCard } from "@/features/developer-role-switch/components/developer-role-switch-card";
import { DeveloperSettingsForm, DeveloperSettingsProvider } from "@/features/developer-settings";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const i18n = await getTranslations(); return { title: i18n("navigation.items.developer-settings") }; }

export default async function DeveloperSettingsPage() {const i18n = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.DEVELOPER_SETTINGS_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  return <div className="space-y-4"><PageHeader title={i18n("navigation.items.developer-settings")} description={i18n("auto.m0056")} /><DeveloperRoleSwitchCard /><DeveloperSettingsProvider><DeveloperSettingsForm /></DeveloperSettingsProvider></div>;
}
